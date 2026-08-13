// dynamo.js
// Grant/revoke admin access. Existing donor account required -- this
// never creates a new account, only elevates one (confirmed Aug 14).

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);
const DONORS_TABLE = process.env.DONORS_TABLE || 'donors';

async function listAdmins() {
  const result = await ddb.send(new ScanCommand({
    TableName: DONORS_TABLE,
    FilterExpression: 'isAdmin = :true',
    ExpressionAttributeValues: { ':true': true },
  }));
  return (result.Items || []).sort((a, b) => (a.email || '').localeCompare(b.email || ''));
}

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

async function grantAdmin(email) {
  if (!email || !email.trim()) throw new Error('Email is required');
  const donor = await findDonorByEmail(email);
  if (!donor) throw new Error(`No account found for ${email}. They need to create a donor account first -- this can't create one for them.`);

  const now = new Date().toISOString();
  const result = await ddb.send(new UpdateCommand({
    TableName: DONORS_TABLE,
    Key: { donorId: donor.donorId },
    UpdateExpression: 'SET isAdmin = :true, updatedAt = :now',
    ExpressionAttributeValues: { ':true': true, ':now': now },
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes;
}

/**
 * Revokes admin access. Deliberately blocks revoking your OWN access --
 * a safety net against accidental self-lockout, especially important
 * once the shared Basic Auth fallback is gone and this system becomes
 * the ONLY way into the admin panel.
 */
async function revokeAdmin(donorId, requestingDonorId) {
  if (donorId === requestingDonorId) {
    throw new Error("You can't revoke your own admin access. Have another admin do it if needed.");
  }

  const now = new Date().toISOString();
  const result = await ddb.send(new UpdateCommand({
    TableName: DONORS_TABLE,
    Key: { donorId },
    ConditionExpression: 'attribute_exists(donorId)',
    UpdateExpression: 'SET isAdmin = :false, updatedAt = :now',
    ExpressionAttributeValues: { ':false': false, ':now': now },
    ReturnValues: 'ALL_NEW',
  })).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  });

  return result ? result.Attributes : null;
}

module.exports = { listAdmins, grantAdmin, revokeAdmin };
