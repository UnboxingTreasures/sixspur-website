// dynamo.js
// Reads/writes for the recurring_donations table -- the monthly-giving
// counterpart to `donations`. Kept as a SEPARATE table rather than
// folding into `donations` because a subscription is a standing record
// with its own lifecycle (pending/active/suspended/cancelled/abandoned)
// that outlives any single payment, whereas `donations` rows are
// one-and-done transaction records. Each successful monthly charge
// still gets its own row written to `donations` (type: "recurring") by
// the webhook Lambda, for receipt/history purposes -- this table just
// tracks the subscription itself, not each individual charge.
//
// Requires a GSI named "donorId-index" (partition key: donorId) on
// recurring_donations -- same naming convention already used on `orders`.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const RECURRING_TABLE = process.env.RECURRING_DONATIONS_TABLE || 'recurring_donations';

// A subscription record is created the moment PayPal confirms the
// subscription server-side (status: 'pending'), BEFORE the donor has
// actually approved it on PayPal's side -- necessary because we need
// somewhere to store the donorId/tier mapping that PayPal's approval
// redirect doesn't carry back to us. Normally this window is seconds.
// But if the donor abandons the PayPal approval screen (closes the
// tab, hits an error, retries in a different browser/session, etc.),
// the record is left behind forever with no webhook ever coming to
// update it, since PayPal never got an approval to fire ACTIVATED for.
//
// Two complementary safeguards handle this:
//   1. abandonPendingSubscriptionsForDonor -- called right before
//      creating a NEW subscription, so a donor who retries (even from
//      a completely different browser session, as happened when a
//      merchant-account block forced a retry in incognito) doesn't
//      accumulate duplicate pending rows. The old attempt is marked
//      'abandoned' immediately rather than left pending indefinitely.
//   2. isStalePending -- a time-based fallback for the case where the
//      donor never retries at all (just closes the tab and leaves),
//      so a truly forgotten pending attempt doesn't sit visible
//      forever either.
const PENDING_STALE_MS = 30 * 60 * 1000; // 30 minutes

function isStalePending(item) {
  if (item.status !== 'pending') return false;
  const createdAt = new Date(item.createdAt).getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt > PENDING_STALE_MS;
}

async function createSubscriptionRecord({ subscriptionId, donorId, donorEmail, tier, isCustom = false }) {
  const now = new Date().toISOString();
  const item = {
    subscriptionId,
    donorId,
    donorEmail,
    tier,
    isCustom,
    status: 'pending', // becomes "active" once BILLING.SUBSCRIPTION.ACTIVATED arrives
    failedPaymentCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await ddb.send(new PutCommand({ TableName: RECURRING_TABLE, Item: item }));
  return item;
}

/**
 * Marks any of this donor's currently-'pending' subscriptions as
 * 'abandoned'. Called immediately before creating a fresh subscription
 * record, so retrying (in the same session or a new one entirely)
 * never leaves more than one live pending attempt behind. Does NOT
 * call PayPal's cancel API -- these subscriptions were never approved,
 * so there's nothing active on PayPal's side to cancel; they simply
 * expire there on their own after PayPal's own approval-window timeout.
 */
async function abandonPendingSubscriptionsForDonor(donorId) {
  const result = await ddb.send(new QueryCommand({
    TableName: RECURRING_TABLE,
    IndexName: 'donorId-index',
    KeyConditionExpression: 'donorId = :donorId',
    ExpressionAttributeValues: { ':donorId': donorId },
  }));

  const pending = (result.Items || []).filter((item) => item.status === 'pending');
  const now = new Date().toISOString();

  await Promise.all(pending.map((item) => ddb.send(new UpdateCommand({
    TableName: RECURRING_TABLE,
    Key: { subscriptionId: item.subscriptionId },
    UpdateExpression: 'SET #status = :status, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': 'abandoned', ':now': now },
  }))));
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
  // Filter out abandoned attempts (explicit, from a retry) and stale
  // pending attempts (implicit, from a donor who never retried at
  // all). A record still legitimately mid-approval (created seconds
  // ago, not yet retried) is unaffected and still shows normally.
  return (result.Items || []).filter((item) => item.status !== 'abandoned' && !isStalePending(item));
}

async function getAllSubscriptions() {
  // Small nonprofit scale -- a full scan is fine for the admin list
  // view, same assumption already made elsewhere in this project for
  // low-volume admin tables. Admin view intentionally does NOT filter
  // abandoned/stale-pending rows the way the donor-facing query does --
  // Richard may want visibility into abandoned attempts for support
  // purposes.
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
  abandonPendingSubscriptionsForDonor,
  getSubscriptionById,
  getSubscriptionsByDonor,
  getAllSubscriptions,
  updateSubscriptionStatus,
  incrementFailedPayments,
};
