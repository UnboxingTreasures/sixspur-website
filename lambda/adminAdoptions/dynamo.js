// dynamo.js
// Read/update access to adoption_applications for the admin Adoptions page.
// Listing by status uses the status-index GSI so each of the four tabs
// (Open / Under Review / Approved / Denied) queries directly rather than
// scanning the whole table on every page load.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.ADOPTION_APPLICATIONS_TABLE || 'adoption_applications';
const STATUS_INDEX = 'status-index';

const VALID_STATUSES = ['Open', 'Under Review', 'Approved', 'Denied'];

async function listByStatus(status) {
  const result = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: STATUS_INDEX,
    KeyConditionExpression: '#status = :status',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': status },
    ScanIndexForward: false, // newest submissions first
  }));
  return result.Items || [];
}

async function listAll() {
  // A full scan is fine at this application's volume (adoption applications,
  // not e-commerce order volume). If this ever gets slow, switch to four
  // parallel listByStatus() queries instead.
  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  return result.Items || [];
}

async function getById(applicationId) {
  const result = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { applicationId } }));
  return result.Item || null;
}

async function updateStatus(applicationId, newStatus) {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (newStatus === 'Open') {
    throw new Error('Cannot move an application back to Open — Open is only the originating status, applications never return to it.');
  }

  const statusUpdatedAt = new Date().toISOString();

  try {
    const result = await ddb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { applicationId },
      // Approved and Denied are terminal -- this condition atomically blocks
      // the update if the record is already in either state, so there's no
      // race window between checking status and writing it.
      ConditionExpression: 'attribute_exists(applicationId) AND #status <> :approved AND #status <> :denied',
      UpdateExpression: 'SET #status = :status, statusUpdatedAt = :statusUpdatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': newStatus,
        ':statusUpdatedAt': statusUpdatedAt,
        ':approved': 'Approved',
        ':denied': 'Denied',
      },
      ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes;
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') throw err;

    // The condition failed for one of two reasons -- the record doesn't
    // exist, or it's already terminal. Look it up once more so the caller
    // gets an accurate message instead of a generic failure either way.
    const existing = await getById(applicationId);
    if (!existing) return null; // genuinely not found -- treated as 404 by the caller
    throw new Error(
      `This application is already "${existing.status}", which is a final status and can't be changed.`
    );
  }
}

module.exports = { listByStatus, listAll, getById, updateStatus, VALID_STATUSES };
