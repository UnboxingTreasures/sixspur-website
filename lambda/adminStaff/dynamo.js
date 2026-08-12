// dynamo.js
// Admin CRUD for staff_members. Simpler than farm_animals -- each person
// has exactly one photo (not a pool), so there's no thumbnail-picker or
// cross-reference-checked delete needed here.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.STAFF_TABLE || 'staff_members';

async function listAll() {
  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  return (result.Items || []).sort((a, b) => a.name.localeCompare(b.name));
}

async function getById(staffId) {
  const result = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { staffId } }));
  return result.Item || null;
}

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function createStaffMember({ name, title, bio, imageUrl }) {
  if (!name || !name.trim()) throw new Error('Name is required');
  if (!imageUrl) throw new Error('An image is required');

  const staffId = slugify(name);
  if (!staffId) throw new Error('Name must contain at least one letter or number');

  const existing = await getById(staffId);
  if (existing) throw new Error(`A staff member with this name already exists (id: ${staffId})`);

  const now = new Date().toISOString();
  const item = {
    staffId,
    name: name.trim(),
    title: title ? title.trim() : '',
    bio: bio ? bio.trim() : '',
    imageUrl,
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
    ConditionExpression: 'attribute_not_exists(staffId)',
  }));

  return item;
}

/**
 * Updates name/title/bio, and optionally imageUrl if a new photo was
 * uploaded. staffId (the slug) never changes even if the name is edited --
 * same convention as farm_animals, keeps URLs and S3 keys stable.
 */
async function updateStaffMember(staffId, { name, title, bio, imageUrl }) {
  const updates = [];
  const values = { ':updatedAt': new Date().toISOString() };
  const names = {};

  if (name !== undefined) {
    if (!name.trim()) throw new Error('Name cannot be empty');
    updates.push('#name = :name');
    names['#name'] = 'name';
    values[':name'] = name.trim();
  }
  if (title !== undefined) {
    updates.push('title = :title');
    values[':title'] = title.trim();
  }
  if (bio !== undefined) {
    updates.push('bio = :bio');
    values[':bio'] = bio.trim();
  }
  if (imageUrl !== undefined) {
    updates.push('imageUrl = :imageUrl');
    values[':imageUrl'] = imageUrl;
  }
  updates.push('updatedAt = :updatedAt');

  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { staffId },
    ConditionExpression: 'attribute_exists(staffId)',
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeValues: values,
    ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
    ReturnValues: 'ALL_NEW',
  })).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  });

  return result ? result.Attributes : null;
}

async function deleteStaffMember(staffId) {
  const existing = await getById(staffId);
  if (!existing) return null;

  await ddb.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { staffId },
    ConditionExpression: 'attribute_exists(staffId)',
  }));

  return existing; // return it so the caller knows the imageUrl to clean up in S3
}

module.exports = { listAll, getById, createStaffMember, updateStaffMember, deleteStaffMember };
