// dynamo.js
// Read/update access to adoption_applications for the admin Adoptions page.
// Listing by status uses the status-index GSI so each of the four tabs
// (Open / Under Review / Approved / Denied) queries directly rather than
// scanning the whole table on every page load.
//
// RECENTLY ADOPTED (added Session 18): when a status update lands on
// "Approved", this also writes adoptedAt onto the linked animal's record
// in adoptable_animals -- confirmed spec: approving IS the action that
// marks an animal adopted, not a separate manual step anywhere else.
// This is a cross-table write from this Lambda (new IAM grant needed,
// see execution-role-policy.json), kept as a best-effort SECOND step
// after the application status update itself succeeds -- if it fails
// (animal deleted, missing animalId on an older application submitted
// before this field existed, etc.), the approval itself still stands;
// this never rolls back or blocks the primary action. Same reasoning as
// notifyApplicant's email-failure handling in index.js.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.ADOPTION_APPLICATIONS_TABLE || 'adoption_applications';
const ADOPTABLE_ANIMALS_TABLE = process.env.ADOPTABLE_ANIMALS_TABLE || 'adoptable_animals';
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

/**
 * Marks the given animal adopted. Conditional on the animal actually
 * existing AND not already being marked adopted -- the latter guards
 * against a (currently impossible, since applications are terminal once
 * Approved/Denied, but cheap to guard anyway) double-approval scenario
 * silently overwriting an earlier adoptedAt with a later one. Returns
 * true/false rather than throwing, since the caller treats this as
 * strictly best-effort.
 */
async function markAnimalAdopted(animalId) {
  try {
    await ddb.send(new UpdateCommand({
      TableName: ADOPTABLE_ANIMALS_TABLE,
      Key: { animalId },
      ConditionExpression: 'attribute_exists(animalId) AND attribute_not_exists(adoptedAt)',
      UpdateExpression: 'SET adoptedAt = :adoptedAt, updatedAt = :adoptedAt',
      ExpressionAttributeValues: { ':adoptedAt': new Date().toISOString() },
    }));
    return true;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      console.warn(`markAnimalAdopted: animal ${animalId} not found or already marked adopted -- skipping`);
      return false;
    }
    console.error(`markAnimalAdopted: failed to mark ${animalId} adopted:`, err);
    return false;
  }
}

async function updateStatus(applicationId, newStatus) {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (newStatus === 'Open') {
    throw new Error('Cannot move an application back to Open — Open is only the originating status, applications never return to it.');
  }

  const statusUpdatedAt = new Date().toISOString();

  let updated;
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
    updated = result.Attributes;
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

  // Best-effort side effect, never allowed to fail or roll back the
  // status change above -- see the file-level comment for why.
  if (newStatus === 'Approved') {
    if (updated.animalId) {
      await markAnimalAdopted(updated.animalId);
    } else {
      console.warn(`Application ${applicationId} approved but has no animalId (likely submitted before this field existed) -- animal not auto-marked adopted.`);
    }
  }

  return updated;
}

module.exports = { listByStatus, listAll, getById, updateStatus, VALID_STATUSES };
