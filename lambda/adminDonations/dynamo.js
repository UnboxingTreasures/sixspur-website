// dynamo.js
// Admin access to the donations table -- view-only plus status/notes
// edits (e.g. marking refunded). All donations come through the real
// PayPal checkout flow (see the donate Lambda) -- manual entry for
// checks/cash was considered and deliberately dropped; the client will
// consolidate online and offline donations themselves rather than the
// system trying to represent both. No delete function on purpose:
// financial records should be marked refunded/voided, not deleted --
// standard nonprofit bookkeeping practice, keeps an honest audit trail.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const DONATIONS_TABLE = process.env.DONATIONS_TABLE || 'donations';

const VALID_STATUSES = ['completed', 'refunded', 'failed'];

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

module.exports = { listAll, getById, updateDonation };
