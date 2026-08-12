// dynamo.js
// Admin access to the donations table -- both real (PayPal-recorded) and
// manual entries (checks, cash) live in the same table with the same
// shape, distinguished by paymentMethod. No delete function on purpose:
// financial records should be marked refunded/voided, not deleted --
// standard nonprofit bookkeeping practice, and keeps an honest audit
// trail even for corrections.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const DONATIONS_TABLE = process.env.DONATIONS_TABLE || 'donations';
const DONORS_TABLE = process.env.DONORS_TABLE || 'donors';

const VALID_STATUSES = ['completed', 'refunded', 'failed'];
const VALID_TYPES = ['one-time', 'recurring'];

async function listAll() {
  const result = await ddb.send(new ScanCommand({ TableName: DONATIONS_TABLE }));
  return (result.Items || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getById(donationId) {
  const result = await ddb.send(new GetCommand({ TableName: DONATIONS_TABLE, Key: { donationId } }));
  return result.Item || null;
}

/**
 * Looks up a donor's email by donorId for display purposes -- donations
 * only store donorId as the source of truth, this is just a convenience
 * lookup so the admin panel can show a name/email instead of a raw ID.
 */
async function getDonorEmail(donorId) {
  if (!donorId) return null;
  const result = await ddb.send(new GetCommand({ TableName: DONORS_TABLE, Key: { donorId } }));
  return result.Item?.email || null;
}

/**
 * Looks up a donor BY email -- what Richard actually has on hand when
 * recording a check or cash donation, not a raw Cognito ID. Uses the
 * email-index GSI (see 00-cognito-setup.txt) rather than a Scan, since
 * this will be a common lookup, not an occasional one.
 */
async function findDonorByEmail(email) {
  const result = await ddb.send(new QueryCommand({
    TableName: DONORS_TABLE,
    IndexName: 'email-index',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': email.trim().toLowerCase() },
    Limit: 1,
  }));
  return result.Items?.[0] || null;
}

/**
 * Manual entry -- for checks, cash, or any donation that didn't come
 * through the PayPal flow. Requires the donor to already have an
 * account, looked up by email (donor accounts are required to donate
 * per the Aug 11 scoping decision, even for manually-recorded gifts --
 * same record-keeping reasoning as everything else). KNOWN LIMITATION:
 * if a longtime check/cash donor doesn't have an account yet, this will
 * fail with a clear error rather than silently creating one -- flagged
 * for Jay to decide how to handle (ask them to sign up first? allow
 * admin-created accounts?).
 */
async function createManualDonation({ donorEmail, amount, currency, type, notes }) {
  if (!donorEmail) throw new Error('donorEmail is required');
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('Amount must be a positive number');
  if (type && !VALID_TYPES.includes(type)) throw new Error(`type must be one of ${VALID_TYPES.join(', ')}`);

  const donor = await findDonorByEmail(donorEmail);
  if (!donor) throw new Error(`No donor account found for ${donorEmail}. They need an account before a donation can be recorded.`);

  const now = new Date().toISOString();
  const item = {
    donationId: randomUUID(),
    donorId: donor.donorId,
    donorEmail: donor.email,
    amount: numericAmount,
    currency: currency || 'USD',
    type: type || 'one-time',
    status: 'completed',
    paymentMethod: 'manual',
    notes: notes || '',
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(new PutCommand({ TableName: DONATIONS_TABLE, Item: item }));
  return item;
}

/**
 * Admin edits -- deliberately narrow. Status (e.g. marking refunded) and
 * notes are editable; amount/donor/date are NOT editable after creation
 * -- if those are wrong, that's a correction that belongs in the notes
 * field with an honest paper trail, not a silent edit to a financial
 * record.
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
  if (fields.receiptUrl !== undefined) {
    updates.push('receiptUrl = :receiptUrl');
    values[':receiptUrl'] = fields.receiptUrl;
  }
  if (fields.receiptSentAt !== undefined) {
    updates.push('receiptSentAt = :receiptSentAt');
    values[':receiptSentAt'] = fields.receiptSentAt;
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

module.exports = { listAll, getById, createManualDonation, updateDonation, getDonorEmail, findDonorByEmail };
