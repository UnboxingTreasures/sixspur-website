// getRecipients.js
// Looks up currently-VERIFIED SMS alert recipients at invocation time,
// so a number added and verified through the admin "Text Alert
// Recipients" UI starts receiving texts immediately -- no redeploy
// needed. The sms_recipients table is the single source of truth for
// status (updated by lambda/adminSmsRecipients/index.js's verify
// handler after a successful SNS verification). Falls back to a
// hardcoded default if the table is empty or unreachable, so
// notifications never silently go to nobody.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);
const TABLE = process.env.SMS_RECIPIENTS_TABLE || 'sms_recipients';
const FALLBACK = ['+18137866333'];

async function getVerifiedRecipients() {
  try {
    const items = [];
    let ExclusiveStartKey;
    do {
      const result = await ddb.send(
        new ScanCommand({
          TableName: TABLE,
          FilterExpression: '#s = :verified',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':verified': 'Verified' },
          ExclusiveStartKey,
        })
      );
      items.push(...(result.Items || []));
      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    const numbers = items.map((i) => i.phoneNumber).filter(Boolean);
    return numbers.length > 0 ? numbers : FALLBACK;
  } catch (err) {
    console.error('getVerifiedRecipients: falling back to default number', err);
    return FALLBACK;
  }
}

module.exports = { getVerifiedRecipients };
