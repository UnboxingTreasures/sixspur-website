// index.js
// POST /api/newsletter — subscribes an email to the subscribers table.
// Idempotent: re-subscribing an already-active email just confirms success;
// re-subscribing a previously unsubscribed email reactivates it.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.SUBSCRIBERS_TABLE || 'subscribers';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, {});
  }

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
};
