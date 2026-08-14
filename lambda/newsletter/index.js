// index.js
// POST /api/newsletter            — subscribes an email to the subscribers table.
// GET  /api/newsletter/unsubscribe — unsubscribes, verified via email + that
//                                     subscriber's own unsubscribeToken (both
//                                     passed as query params from the link in
//                                     the email itself). No login required --
//                                     subscribing never created an account,
//                                     so unsubscribing can't require one either.
//                                     Verifying the token (not just the email
//                                     alone) means the link can't be used to
//                                     unsubscribe someone else just by knowing
//                                     their email address.
//
// Both routes are public -- deliberately no admin auth here. Subscribing
// and unsubscribing are self-service actions by design.
//
// Mailing list sync: if the unsubscribing email also belongs to a donor
// account (looked up via the donors table's email-index GSI), that
// donor's mailingListOptIn is flipped to false too, so their account
// page checkbox reflects reality rather than staying stale-checked.
// This is the reverse of the sync direction the donors Lambda owns
// (donor toggling their own checkbox -> subscribers row).

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.SUBSCRIBERS_TABLE || 'subscribers';
const DONORS_TABLE = process.env.DONORS_TABLE || 'donors';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handleSubscribe(event) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  const email = (body.email || '').trim().toLowerCase();

  if (!email || !EMAIL_REGEX.test(email)) {
    return respond(400, { error: 'A valid email address is required' });
  }

  try {
    // Check if already subscribed (active or previously unsubscribed)
    const existing = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { email } }));

    if (existing.Item && existing.Item.isActive) {
      // Already subscribed — treat as success, not an error, so the
      // frontend doesn't need special-case handling for "already on the list"
      return respond(200, { success: true, alreadySubscribed: true });
    }

    const unsubscribeToken = existing.Item?.unsubscribeToken || randomUUID();

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          email,
          subscribedAt: new Date().toISOString(),
          isActive: true,
          unsubscribeToken,
        },
      })
    );

    return respond(200, { success: true, alreadySubscribed: false });
  } catch (err) {
    console.error('Newsletter subscription failed:', err);
    return respond(500, { error: 'Something went wrong. Please try again.' });
  }
}

/**
 * If this email belongs to a donor account, flip their mailingListOptIn
 * to false too. Best-effort: failures here are logged but never block
 * the actual unsubscribe response, since the subscribers-table update
 * (the part that actually stops emails) has already succeeded by the
 * time this runs.
 */
async function syncDonorOptOut(email) {
  try {
    const result = await ddb.send(new QueryCommand({
      TableName: DONORS_TABLE,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email },
    }));

    const donor = result.Items?.[0];
    if (!donor) return;

    await ddb.send(new UpdateCommand({
      TableName: DONORS_TABLE,
      Key: { donorId: donor.donorId },
      UpdateExpression: 'SET mailingListOptIn = :false, updatedAt = :updatedAt',
      ExpressionAttributeValues: { ':false': false, ':updatedAt': new Date().toISOString() },
    }));
  } catch (err) {
    console.error('Donor mailing list sync failed (non-fatal):', err);
  }
}

async function handleUnsubscribe(event) {
  const qs = event.queryStringParameters || {};
  const email = (qs.email || '').trim().toLowerCase();
  const token = qs.token || '';

  if (!email || !token) {
    return respond(400, { error: 'This unsubscribe link is missing information and can\'t be processed.' });
  }

  try {
    const existing = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { email } }));

    if (!existing.Item) {
      // No record at all -- treat as success anyway. Someone clicking an
      // old/already-processed unsubscribe link should see "you're
      // unsubscribed", not an error, regardless of the reason.
      return respond(200, { success: true, alreadyUnsubscribed: true });
    }

    if (existing.Item.unsubscribeToken !== token) {
      return respond(403, { error: 'This unsubscribe link is invalid.' });
    }

    if (!existing.Item.isActive) {
      return respond(200, { success: true, alreadyUnsubscribed: true });
    }

    await ddb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { email },
      UpdateExpression: 'SET isActive = :inactive',
      ExpressionAttributeValues: { ':inactive': false },
    }));

    await syncDonorOptOut(email);

    return respond(200, { success: true, alreadyUnsubscribed: false });
  } catch (err) {
    console.error('Newsletter unsubscribe failed:', err);
    return respond(500, { error: 'Something went wrong. Please try again.' });
  }
}

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, {});
  }

  switch (event.routeKey) {
    case 'POST /api/newsletter':
      return await handleSubscribe(event);
    case 'GET /api/newsletter/unsubscribe':
      return await handleUnsubscribe(event);
    default:
      return respond(404, { error: `No handler for route: ${event.routeKey}` });
  }
};
