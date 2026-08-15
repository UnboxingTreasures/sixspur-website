// dynamo.js
// Reads/writes for the recurring_donations table -- the monthly-giving
// counterpart to `donations`. Kept as a SEPARATE table rather than
// folding into `donations` because a subscription is a standing record
// with its own lifecycle (pending/active/suspended/cancelled) that
// outlives any single payment, whereas `donations` rows are one-and-done
// transaction records. Each successful monthly charge still gets its own
// row written to `donations` (type: "recurring") by the webhook Lambda,
// for receipt/history purposes -- this table just tracks the
// subscription itself, not each individual charge.
//
// Requires a GSI named "donorId-index" (partition key: donorId) on
// recurring_donations -- same naming convention already used on `orders`.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const RECURRING_TABLE = process.env.RECURRING_DONATIONS_TABLE || 'recurring_donations';

async function createSubscriptionRecord({ subscriptionId, donorId, donorEmail, tier }) {
  const now = new Date().toISOString();
  const item = {
    subscriptionId,
    donorId,
    donorEmail,
    tier,
    status: 'pending', // becomes "active" once BILLING.SUBSCRIPTION.ACTIVATED arrives
    failedPaymentCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await ddb.send(new PutCommand({ TableName: RECURRING_TABLE, Item: item }));
  return item;
}

async function getSubscriptionById(subscriptionId) {
  const result = await ddb.send(new GetCommand({ TableName: RECURRING_TABLE, Key: { subscriptionId } }));
  return result.Item || null;
}

async function getSubscriptionsByDonor(donorId) {
  const result = await ddb.send(new QueryCommand({
    TableName: RECURRING_TABLE,
    IndexName: 'donorId-index',
    KeyConditionExpression: 'donorId = :donorId',
    ExpressionAttributeValues: { ':donorId': donorId },
  }));
  return result.Items || [];
}

async function getAllSubscriptions() {
  // Small nonprofit scale -- a full scan is fine for the admin list
  // view, same assumption already made elsewhere in this project for
  // low-volume admin tables.
  const result = await ddb.send(new ScanCommand({ TableName: RECURRING_TABLE }));
  return result.Items || [];
}

/**
 * The single write path for subscription status changes driven by
 * PayPal webhooks -- covers activation, suspension, cancellation, and
 * next-billing-date/last-payment bookkeeping. Deliberately generic
 * (pass whatever fields changed) rather than one function per event
 * type, since every event boils down to "update status + maybe a
 * timestamp field".
 */
async function updateSubscriptionStatus(subscriptionId, status, extraFields = {}) {
  const now = new Date().toISOString();
  const fields = { status, updatedAt: now, ...extraFields };

  const setClauses = [];
  const values = {};
  const names = {};
  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`#${key} = :${key}`);
    names[`#${key}`] = key;
    values[`:${key}`] = value;
  }

  await ddb.send(new UpdateCommand({
    TableName: RECURRING_TABLE,
    Key: { subscriptionId },
    UpdateExpression: `SET ${setClauses.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

async function incrementFailedPayments(subscriptionId) {
  const now = new Date().toISOString();
  await ddb.send(new UpdateCommand({
    TableName: RECURRING_TABLE,
    Key: { subscriptionId },
    UpdateExpression: 'SET failedPaymentCount = if_not_exists(failedPaymentCount, :zero) + :one, updatedAt = :now',
    ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':now': now },
  }));
}

module.exports = {
  createSubscriptionRecord,
  getSubscriptionById,
  getSubscriptionsByDonor,
  getAllSubscriptions,
  updateSubscriptionStatus,
  incrementFailedPayments,
};
