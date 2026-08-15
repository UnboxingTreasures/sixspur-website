// adminAuth.js
// Identical to lambda/adminDonations/adminAuth.js -- same "duplicate per
// Lambda" pattern used throughout this project. Requires the JWT
// authorizer already on /donor/* and /donate/* routes to also be
// attached here; this function does the second check (isAdmin=true on
// the donor record), which a JWT alone can't answer.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);
const DONORS_TABLE = process.env.DONORS_TABLE || 'donors';

async function requireAdmin(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims?.sub) {
    return { authorized: false, statusCode: 401, error: 'Not authenticated' };
  }

  const result = await ddb.send(new GetCommand({ TableName: DONORS_TABLE, Key: { donorId: claims.sub } }));
  if (!result.Item?.isAdmin) {
    return { authorized: false, statusCode: 403, error: 'Admin access required' };
  }

  return { authorized: true, donorId: claims.sub };
}

module.exports = { requireAdmin };
