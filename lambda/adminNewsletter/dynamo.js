// dynamo.js
// Read access to the subscribers table for the admin newsletter compose
// flow. This Lambda never writes to subscribers -- subscribing happens
// via the public newsletter Lambda, unsubscribing via that same Lambda's
// new /newsletter/unsubscribe route. Admin-side, this is read-only:
// who's currently active, so a blast knows who to email.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const SUBSCRIBERS_TABLE = process.env.SUBSCRIBERS_TABLE || 'subscribers';

/**
 * Returns every subscriber with isActive === true. A Scan+filter, same
 * approach used for the fundraiser's live raisedAmount elsewhere in this
 * project -- fine at nonprofit mailing-list scale (dozens to low
 * hundreds), not something that needs a GSI for a table this size.
 */
async function listActiveSubscribers() {
  const items = [];
  let ExclusiveStartKey;

  do {
    const result = await ddb.send(new ScanCommand({
      TableName: SUBSCRIBERS_TABLE,
      FilterExpression: 'isActive = :active',
      ExpressionAttributeValues: { ':active': true },
      ExclusiveStartKey,
    }));
    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items;
}

module.exports = { listActiveSubscribers };
