// dynamo.js
// Read-only access to recurring_donations for the admin view -- no
// writes here. Status changes come exclusively from the PayPal webhook
// (donate-recurring-webhook), never from an admin action directly, so
// there's no updateSubscription function in this file on purpose: an
// admin "cancel" still has to go through PayPal's API and wait for the
// webhook to confirm, same as a donor-initiated one. If a cancel button
// gets added to the admin UI later, it should call the donor-facing
// cancel Lambda's logic (or a thin admin-authorized wrapper around
// paypal.js's cancelSubscription), not write straight to this table.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const RECURRING_TABLE = process.env.RECURRING_DONATIONS_TABLE || 'recurring_donations';

async function listAll() {
  // Small nonprofit scale -- a full scan is fine here, same assumption
  // used for the one-time donations admin list.
  const result = await ddb.send(new ScanCommand({ TableName: RECURRING_TABLE }));
  return result.Items || [];
}

async function getById(subscriptionId) {
  const result = await ddb.send(new GetCommand({ TableName: RECURRING_TABLE, Key: { subscriptionId } }));
  return result.Item || null;
}

module.exports = { listAll, getById };
