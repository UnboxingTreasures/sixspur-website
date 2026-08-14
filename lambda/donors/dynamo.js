// dynamo.js
// Data access for donor profiles and their own donation history.
// CRITICAL SECURITY NOTE: every function here takes donorId as a
// parameter that the CALLER (index.js) must source from the verified
// JWT claims (event.requestContext.authorizer.jwt.claims.sub), never
// from the request body or a query parameter. A donor must never be
// able to pass someone else's ID and see their donations.
//
// Mailing list sync: mailingListOptIn on a donor's own profile and
// isActive on their matching subscribers row (same email) are kept in
// sync in both directions. This file owns the donor -> subscribers
// direction (seeding on first login, syncing on toggle). The reverse
// direction (subscribers -> donor, when someone unsubscribes via the
// email link) is owned by the newsletter Lambda's handleUnsubscribe.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const DONORS_TABLE = process.env.DONORS_TABLE || 'donors';
const DONATIONS_TABLE = process.env.DONATIONS_TABLE || 'donations';
const SUBSCRIBERS_TABLE = process.env.SUBSCRIBERS_TABLE || 'subscribers';

async function getProfile(donorId) {
  const result = await ddb.send(new GetCommand({ TableName: DONORS_TABLE, Key: { donorId } }));
  return result.Item || null;
}

/**
 * Looks up this email's existing subscribers row, if any. Used to seed
 * a new donor profile's mailingListOptIn with the right initial value,
 * and to preserve an existing unsubscribeToken rather than issuing a
 * new one when syncing.
 */
async function getSubscriberByEmail(email) {
  const result = await ddb.send(new GetCommand({ TableName: SUBSCRIBERS_TABLE, Key: { email } }));
  return result.Item || null;
}

/**
 * Creates or updates the subscribers row for this email to match the
 * donor's mailingListOptIn preference. Preserves the existing
 * unsubscribeToken if one already exists (so any previously-sent email
 * links keep working), otherwise issues a new one.
 */
async function syncSubscriberRecord(email, isActive) {
  const existing = await getSubscriberByEmail(email);
  const unsubscribeToken = existing?.unsubscribeToken || randomUUID();

  await ddb.send(new PutCommand({
    TableName: SUBSCRIBERS_TABLE,
    Item: {
      email,
      isActive,
      unsubscribeToken,
      subscribedAt: existing?.subscribedAt || new Date().toISOString(),
    },
  }));
}

/**
 * Creates the donor's profile row on first login/signup if it doesn't
 * already exist -- Cognito owns the actual credentials, this table just
 * holds the business-data extras Cognito doesn't (mailing list opt-in).
 * If this email already has an active subscribers row (e.g. they
 * subscribed via the public form before ever creating an account),
 * the new profile is seeded as already opted in, so the checkbox
 * reflects reality on first load rather than defaulting to unchecked.
 */
async function ensureProfile(donorId, email) {
  const existing = await getProfile(donorId);
  if (existing) return existing;

  const existingSubscriber = await getSubscriberByEmail(email);
  const mailingListOptIn = Boolean(existingSubscriber?.isActive);

  const now = new Date().toISOString();
  const item = { donorId, email, mailingListOptIn, createdAt: now, updatedAt: now };
  await ddb.send(new PutCommand({ TableName: DONORS_TABLE, Item: item }));
  return item;
}

async function updateProfile(donorId, fields) {
  const updates = [];
  const values = { ':updatedAt': new Date().toISOString() };

  if (fields.mailingListOptIn !== undefined) {
    updates.push('mailingListOptIn = :optIn');
    values[':optIn'] = Boolean(fields.mailingListOptIn);
  }
  if (fields.email !== undefined) {
    updates.push('email = :email');
    values[':email'] = fields.email;
  }
  updates.push('updatedAt = :updatedAt');

  const result = await ddb.send(new UpdateCommand({
    TableName: DONORS_TABLE,
    Key: { donorId },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));

  // Keep the subscribers table in sync whenever the opt-in preference
  // changes. Uses the donor's CURRENT email on file (post-update if
  // email was also changed this call), not a stale value.
  if (fields.mailingListOptIn !== undefined) {
    await syncSubscriberRecord(result.Attributes.email, Boolean(fields.mailingListOptIn));
  }

  return result.Attributes;
}

/**
 * Returns this donor's own donations, newest first. Uses the
 * donorId-index GSI -- never a table Scan, which would risk exposing
 * other donors' records if this function were ever called incorrectly.
 */
async function listDonationsForDonor(donorId) {
  const result = await ddb.send(new QueryCommand({
    TableName: DONATIONS_TABLE,
    IndexName: 'donorId-index',
    KeyConditionExpression: 'donorId = :donorId',
    ExpressionAttributeValues: { ':donorId': donorId },
    ScanIndexForward: false, // newest first
  }));
  return result.Items || [];
}

async function getDonationForDonor(donorId, donationId) {
  const result = await ddb.send(new GetCommand({ TableName: DONATIONS_TABLE, Key: { donationId } }));
  const donation = result.Item;
  // Ownership check -- a donor can only ever fetch their OWN donation by ID,
  // even if they guess/enumerate another donation's ID.
  if (!donation || donation.donorId !== donorId) return null;
  return donation;
}

module.exports = { getProfile, ensureProfile, updateProfile, listDonationsForDonor, getDonationForDonor };
