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

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const ORDERS_TABLE = process.env.ORDERS_TABLE || 'orders';

const ADMIN_EDITABLE_STATUSES = ['paid', 'shipped', 'refunded'];

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
 * adminDonations/dynamo.js's updateDonation. status (paid -> shipped or
 * paid -> refunded), trackingNumber, and notes are editable; everything
 * about what was actually bought/paid/shipped-to is not.
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

module.exports = { listAll, getById, updateOrder };
