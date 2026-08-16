// dynamo.js
// Admin access to the orders table -- view-only plus status/notes/
// tracking edits. Mirrors lambda/adminDonations/dynamo.js's shape and
// reasoning: no delete function on purpose, financial/fulfillment
// records get marked (shipped, refunded), not deleted -- keeps an
// honest audit trail. Amount/items/shipping address are NOT editable
// after creation -- if those are wrong, that belongs in notes as a
// correction, not a silent edit to what the buyer actually paid for.
//
// 'pending' and 'expired' are NOT admin-editable statuses -- those are
// internal states owned entirely by the checkout/reservation system
// (lambda/orders and lambda/expireOrderReservations). An admin can only
// move a real completed sale forward (paid -> shipped) or back
// (paid -> refunded); there's nothing for a person to manage on an
// order that was never actually paid for.
//
// UPDATED -- real refund tracking, same pattern as adminDonations:
// refundedAmount (cumulative), refundHistory (audit trail), and status
// becomes 'partially_refunded' vs 'refunded' based on whether the
// order's full total has been returned yet.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const ORDERS_TABLE = process.env.ORDERS_TABLE || 'orders';

const ADMIN_EDITABLE_STATUSES = ['paid', 'shipped', 'refunded', 'partially_refunded'];

async function listAll() {
  const result = await ddb.send(new ScanCommand({ TableName: ORDERS_TABLE }));
  // 'pending' reservations still mid-checkout and already-'expired'
  // abandoned carts aren't real orders from an admin's perspective --
  // filtered out here so the list is purely "things that actually
  // happened", not internal checkout plumbing.
  return (result.Items || [])
    .filter((o) => o.status !== 'pending' && o.status !== 'expired')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getById(orderId) {
  const result = await ddb.send(new GetCommand({ TableName: ORDERS_TABLE, Key: { orderId } }));
  return result.Item || null;
}

/**
 * Admin edits -- deliberately narrow, same reasoning as
 * adminDonations/dynamo.js's updateDonation. status (paid -> shipped),
 * trackingNumber, and notes are editable directly; everything about
 * what was actually bought/paid/shipped-to is not.
 *
 * NOTE: refunds specifically go through recordRefund() below instead,
 * which is the only path that also updates refundedAmount/
 * refundHistory -- index.js never allows this function to be called
 * with status:'refunded' directly for that reason.
 */
async function updateOrder(orderId, fields) {
  const updates = [];
  const values = { ':updatedAt': new Date().toISOString() };
  const names = {};

  if (fields.status !== undefined) {
    if (!ADMIN_EDITABLE_STATUSES.includes(fields.status)) {
      throw new Error(`status must be one of ${ADMIN_EDITABLE_STATUSES.join(', ')}`);
    }
    updates.push('#status = :status');
    names['#status'] = 'status';
    values[':status'] = fields.status;
  }
  if (fields.trackingNumber !== undefined) {
    updates.push('trackingNumber = :trackingNumber');
    values[':trackingNumber'] = fields.trackingNumber;
  }
  if (fields.notes !== undefined) {
    updates.push('notes = :notes');
    values[':notes'] = fields.notes;
  }
  updates.push('updatedAt = :updatedAt');

  const result = await ddb.send(new UpdateCommand({
    TableName: ORDERS_TABLE,
    Key: { orderId },
    ConditionExpression: 'attribute_exists(orderId)',
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  })).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  });

  return result ? result.Attributes : null;
}

/**
 * Same idempotency key derivation as adminDonations/dynamo.js -- see
 * that file's comment for the full reasoning. Built from orderId,
 * requested amount, and amount already refunded before this attempt.
 */
function buildRefundIdempotencyKey(orderId, requestedAmount, refundedAmountSoFar) {
  return `sixspur-refund-order-${orderId}-${refundedAmountSoFar.toFixed(2)}-${requestedAmount.toFixed(2)}`;
}

/**
 * Records a SUCCESSFUL PayPal refund against an order. Only ever called
 * after refundCapture() (paypal.js) has already succeeded -- pure
 * bookkeeping, no PayPal communication here. Same conditional-write
 * race guard as adminDonations' recordRefund.
 */
async function recordRefund(orderId, { refundId, amount, currency, expectedRefundedAmountSoFar }) {
  const order = await getById(orderId);
  if (!order) throw new Error('Order not found');

  const newRefundedAmount = Math.round((expectedRefundedAmountSoFar + amount) * 100) / 100;
  const isFullyRefunded = newRefundedAmount >= order.total - 0.005; // tolerate float rounding
  const now = new Date().toISOString();

  const historyEntry = { refundId, amount, currency, refundedAt: now };

  const result = await ddb.send(new UpdateCommand({
    TableName: ORDERS_TABLE,
    Key: { orderId },
    ConditionExpression: 'attribute_exists(orderId) AND (attribute_not_exists(refundedAmount) OR refundedAmount = :expected)',
    UpdateExpression:
      'SET refundedAmount = :newAmount, ' +
      '#status = :status, ' +
      'updatedAt = :now, ' +
      'refundHistory = list_append(if_not_exists(refundHistory, :emptyList), :historyEntry)',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':expected': expectedRefundedAmountSoFar,
      ':newAmount': newRefundedAmount,
      ':status': isFullyRefunded ? 'refunded' : 'partially_refunded',
      ':now': now,
      ':emptyList': [],
      ':historyEntry': [historyEntry],
    },
    ReturnValues: 'ALL_NEW',
  })).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  });

  return result ? result.Attributes : null;
}

module.exports = { listAll, getById, updateOrder, recordRefund, buildRefundIdempotencyKey };
