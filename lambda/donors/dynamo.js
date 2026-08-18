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
//
// UPDATED (Session 20) -- added `name`, a real display name field on
// the donor profile. Added specifically so blog comments (built right
// after this) have something better to show publicly than a raw email
// address. Optional -- a donor with no name set yet simply can't post
// a comment until they add one (see lambda/news's comment-creation
// route for that check); nothing else on the site currently requires
// it.

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

async function getSubscriberByEmail(email) {
  const result = await ddb.send(new GetCommand({ TableName: SUBSCRIBERS_TABLE, Key: { email } }));
  return result.Item || null;
}

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
  if (fields.name !== undefined) {
    const trimmed = String(fields.name).trim();
    if (!trimmed) throw new Error('Name cannot be empty');
    if (trimmed.length > 60) throw new Error('Name must be 60 characters or fewer');
    updates.push('#name = :name');
    values[':name'] = trimmed;
  }
  updates.push('updatedAt = :updatedAt');

  const names = fields.name !== undefined ? { '#name': 'name' } : undefined;

  const result = await ddb.send(new UpdateCommand({
    TableName: DONORS_TABLE,
    Key: { donorId },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));

  if (fields.mailingListOptIn !== undefined) {
    await syncSubscriberRecord(result.Attributes.email, Boolean(fields.mailingListOptIn));
  }

  return result.Attributes;
}

async function listDonationsForDonor(donorId) {
  const result = await ddb.send(new QueryCommand({
    TableName: DONATIONS_TABLE,
    IndexName: 'donorId-index',
    KeyConditionExpression: 'donorId = :donorId',
    ExpressionAttributeValues: { ':donorId': donorId },
    ScanIndexForward: false,
  }));
  return result.Items || [];
}

async function getDonationForDonor(donorId, donationId) {
  const result = await ddb.send(new GetCommand({ TableName: DONATIONS_TABLE, Key: { donationId } }));
  const donation = result.Item;
  if (!donation || donation.donorId !== donorId) return null;
  return donation;
}

module.exports = { getProfile, ensureProfile, updateProfile, listDonationsForDonor, getDonationForDonor };
