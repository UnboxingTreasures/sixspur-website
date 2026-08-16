// adminAuth.js
// Shared admin-authorization check, copied into every admin Lambda
// (same "duplicate per Lambda" pattern already used for s3.js/dynamo.js
// elsewhere in this project, not a Lambda Layer).
//
// Requires the JWT authorizer already protecting /donor/* and /donate/*
// to ALSO be attached to this Lambda's routes -- that authorizer proves
// "this is a real logged-in person." This function does the SECOND,
// separate check: does this specific person have isAdmin=true on their
// donor record. A JWT alone can't answer that -- it's a database lookup,
// not something encoded in the token itself.
//
// UPDATED -- now also returns the caller's email alongside donorId,
// since the isAdmin lookup already reads the full donor record. Needed
// so index.js can check the caller's email against the super-admin
// allowlist for revoking access, without a second DB round-trip.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);
const DONORS_TABLE = process.env.DONORS_TABLE || 'donors';

/**
 * Checks whether the verified JWT identity on this request belongs to
 * an admin. Returns { authorized: true, donorId, email } on success, or
 * { authorized: false, statusCode, error } on failure -- callers should
 * short-circuit and return that response directly (via their own
 * respond() helper) when authorized is false, rather than proceeding.
 */
async function requireAdmin(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims?.sub) {
    return { authorized: false, statusCode: 401, error: 'Not authenticated' };
  }

  const result = await ddb.send(new GetCommand({ TableName: DONORS_TABLE, Key: { donorId: claims.sub } }));
  if (!result.Item?.isAdmin) {
    return { authorized: false, statusCode: 403, error: 'Admin access required' };
  }

  return { authorized: true, donorId: claims.sub, email: result.Item.email };
}

module.exports = { requireAdmin };
