// dynamo.js
// CRUD for the sms_recipients table. Stores the human-friendly label
// (whose number it is), who added it, and status -- status is the
// source of truth the 5 notification Lambdas (donate, orders,
// adoptionApplication, contactForm, processIncomingEmail) read directly
// via getRecipients.js at invocation time.
//
// Recipients are created as Verified directly -- no SNS sandbox OTP
// step anymore now that the account is out of sandbox.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);
const TABLE = process.env.SMS_RECIPIENTS_TABLE || 'sms_recipients';

async function putRecipient({ phoneNumber, label, addedBy }) {
  const item = { phoneNumber, label, addedBy, addedAt: new Date().toISOString(), status: 'Verified' };
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function deleteRecipient(phoneNumber) {
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { phoneNumber } }));
}

async function listRecipients() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey }));
    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

module.exports = { putRecipient, deleteRecipient, listRecipients };
