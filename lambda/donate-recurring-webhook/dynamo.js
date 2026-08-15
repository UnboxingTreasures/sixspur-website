// dynamo.js
// Same recurring_donations table helpers as lambda/donate-recurring/dynamo.js
// -- duplicated here since these are two separate Lambdas. The webhook
// only needs the read/update paths (a subscription record already
// exists by the time any webhook fires for it), not creation.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const RECURRING_TABLE = process.env.RECURRING_DONATIONS_TABLE || 'recurring_donations';

async function getSubscriptionById(subscriptionId) {
  const result = await ddb.send(new GetCommand({ TableName: RECURRING_TABLE, Key: { subscriptionId } }));
  return result.Item || null;
}

async function updateSubscriptionStatus(subscriptionId, status, extraFields = {}) {
  const now = new Date().toISOString();
  const fields = { status, updatedAt: now, ...extraFields };

  const setClauses = [];
  const values = {};
  const names = {};
  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`#${key} = :${key}`);
    names[`#${key}`] = key;
    values[`:${key}`] = value;
  }

  await ddb.send(new UpdateCommand({
    TableName: RECURRING_TABLE,
    Key: { subscriptionId },
    UpdateExpression: `SET ${setClauses.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

async function incrementFailedPayments(subscriptionId) {
  const now = new Date().toISOString();
  await ddb.send(new UpdateCommand({
    TableName: RECURRING_TABLE,
    Key: { subscriptionId },
    UpdateExpression: 'SET failedPaymentCount = if_not_exists(failedPaymentCount, :zero) + :one, updatedAt = :now',
    ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':now': now },
  }));
}

module.exports = { getSubscriptionById, updateSubscriptionStatus, incrementFailedPayments };
