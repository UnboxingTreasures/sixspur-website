// dynamo.js
// Admin access to the donations table -- view-only plus status/notes
// edits (e.g. marking refunded). All donations come through the real
// PayPal checkout flow (see the donate Lambda) -- manual entry for
// checks/cash was considered and deliberately dropped; the client will
// consolidate online and offline donations themselves rather than the
// system trying to represent both. No delete function on purpose:
// financial records should be marked refunded/voided, not deleted --
// standard nonprofit bookkeeping practice, keeps an honest audit trail.
//
// UPDATED -- real refund tracking. Previously "refunded" was just a
// status flip with no connection to whether money had actually moved.
// Now: refundedAmount (cumulative), refundHistory (append-only audit
// trail of every individual refund call, successful or not applicable
// here since only successful calls ever get recorded), and status
// becomes 'partially_refunded' vs 'refunded' based on whether the full
// original amount has been returned yet.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const DONATIONS_TABLE = process.env.DONATIONS_TABLE || 'donations';

const VALID_STATUSES = ['completed', 'partially_refunded', 'refunded', 'failed'];

async function listAll() {
  const result = await ddb.send(new ScanCommand({ TableName: DONATIONS_TABLE }));
  return (result.Items || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getById(donationId) {
  const result = await ddb.send(new GetCommand({ TableName: DONATIONS_TABLE, Key: { donationId } }));
  return result.Item || null;
}

/**
 * Admin edits -- deliberately narrow. Status (e.g. marking refunded) and
 * notes are editable; amount/donor/date are NOT editable after creation
 * -- if those are wrong, that's a correction that belongs in the notes
 * field with an honest paper trail, not a silent edit to a financial
 * record.
 *
 * NOTE: this is for direct/manual status or notes edits only. Refunds
 * specifically go through recordRefund() below instead, which is the
 * only path that also updates refundedAmount/refundHistory -- calling
 * updateDonation with status:'refunded' directly would flip the status
 * without any of the actual refund bookkeeping, so the admin route
 * intentionally never allows that combination (see index.js).
 */
async function updateDonation(donationId, fields) {
  const updates = [];
  const values = { ':updatedAt': new Date().toISOString() };

  if (fields.status !== undefined) {
    if (!VALID_STATUSES.includes(fields.status)) throw new Error(`status must be one of ${VALID_STATUSES.join(', ')}`);
    updates.push('#status = :status');
    values[':status'] = fields.status;
  }
  if (fields.notes !== undefined) {
    updates.push('notes = :notes');
    values[':notes'] = fields.notes;
  }
  updates.push('updatedAt = :updatedAt');

  const result = await ddb.send(new UpdateCommand({
    TableName: DONATIONS_TABLE,
    Key: { donationId },
    ConditionExpression: 'attribute_exists(donationId)',
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeNames: fields.status !== undefined ? { '#status': 'status' } : undefined,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  })).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  });

  return result ? result.Attributes : null;
}

/**
 * Derives a stable PayPal idempotency key for a refund attempt. Built
 * from the donation ID, the requested amount, and how much had already
 * been refunded BEFORE this attempt -- retrying the exact same attempt
 * (e.g. our DynamoDB write failed after PayPal already succeeded, and
 * the admin clicks Refund again with nothing else changed) reproduces
 * the identical key, so PayPal recognizes it and returns the original
 * result instead of refunding twice. A genuinely separate LATER partial
 * refund has a different "already refunded" baseline by then, so it
 * naturally gets a different key.
 */
function buildRefundIdempotencyKey(donationId, requestedAmount, refundedAmountSoFar) {
  return `sixspur-refund-donation-${donationId}-${refundedAmountSoFar.toFixed(2)}-${requestedAmount.toFixed(2)}`;
}

/**
 * Records a SUCCESSFUL PayPal refund against a donation. Only ever
 * called after refundCapture() (paypal.js) has already succeeded --
 * this function does no PayPal communication itself, purely bookkeeping.
 *
 * Conditional on the donation's refundedAmount still matching what the
 * caller expected it to be when it computed the refund amount --
 * guards against a lost-update race if, somehow, two refund requests
 * for the same donation were in flight at once (extremely unlikely
 * given this is a single admin clicking a button, but cheap to guard
 * against and matches this table's existing ConditionExpression
 * pattern used everywhere else).
 */
async function recordRefund(donationId, { refundId, amount, currency, expectedRefundedAmountSoFar }) {
  const donation = await getById(donationId);
  if (!donation) throw new Error('Donation not found');

  const newRefundedAmount = Math.round((expectedRefundedAmountSoFar + amount) * 100) / 100;
  const isFullyRefunded = newRefundedAmount >= donation.amount - 0.005; // tolerate float rounding
  const now = new Date().toISOString();

  const historyEntry = { refundId, amount, currency, refundedAt: now };

  const result = await ddb.send(new UpdateCommand({
    TableName: DONATIONS_TABLE,
    Key: { donationId },
    ConditionExpression: 'attribute_exists(donationId) AND (attribute_not_exists(refundedAmount) OR refundedAmount = :expected)',
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

module.exports = { listAll, getById, updateDonation, recordRefund, buildRefundIdempotencyKey };
