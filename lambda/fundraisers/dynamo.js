// dynamo.js
// Public read access to fundraisers. The "raised so far" total is a
// live sum over the donations table (status=completed, matching
// campaignId), never a stored/manually-maintained number -- exactly
// per the Aug 12 scoping decision, so the thermometer can't drift out
// of sync with actual donations.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const FUNDRAISERS_TABLE = process.env.FUNDRAISERS_TABLE || 'fundraisers';
const DONATIONS_TABLE = process.env.DONATIONS_TABLE || 'donations';

/**
 * Returns the current active fundraiser, or null if none. Only one
 * active fundraiser is expected at a time (Aug 12 scoping: "create,
 * begin, or stop A fundraiser") -- if somehow more than one is active,
 * returns the most recently started one rather than erroring.
 */
async function getActiveFundraiser() {
  const result = await ddb.send(new ScanCommand({
    TableName: FUNDRAISERS_TABLE,
    FilterExpression: '#status = :active',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':active': 'active' },
  }));

  const active = result.Items || [];
  if (active.length === 0) return null;

  active.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const fundraiser = active[0];

  const raisedAmount = await getRaisedAmount(fundraiser.fundraiserId);
  return { ...fundraiser, raisedAmount };
}

/**
 * Live sum of completed donations tagged to this fundraiser. A plain
 * Scan+filter, not a Query -- donations doesn't have a campaignId-index
 * GSI (would only be worth adding if this table grows large and this
 * becomes a hot path; fine at current volume, same reasoning already
 * used elsewhere in this project for small tables).
 */
async function getRaisedAmount(fundraiserId) {
  const result = await ddb.send(new ScanCommand({
    TableName: DONATIONS_TABLE,
    FilterExpression: 'campaignId = :campaignId AND #status = :completed',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':campaignId': fundraiserId, ':completed': 'completed' },
  }));
  return (result.Items || []).reduce((sum, d) => sum + Number(d.amount || 0), 0);
}

module.exports = { getActiveFundraiser };
