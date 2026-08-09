// dynamo.js
// Admin read/write access to farm_animals: type create/rename/delete, and
// managing each type's photo pool (add, remove, set thumbnail).

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.FARM_ANIMALS_TABLE || 'farm_animals';

async function listAll() {
  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  return (result.Items || []).sort((a, b) => a.name.localeCompare(b.name));
}

async function getById(animalId) {
  const result = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { animalId } }));
  return result.Item || null;
}

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function createType({ name, description, seedPhotoUrl }) {
  const animalId = slugify(name);
  if (!animalId) throw new Error('Name must contain at least one letter or number');

  const existing = await getById(animalId);
  if (existing) throw new Error(`An animal type with this name already exists (id: ${animalId})`);

  const now = new Date().toISOString();
  const item = {
    animalId,
    name: name.trim(),
    description: description ? description.trim() : '',
    thumbnailUrl: seedPhotoUrl,
    photos: [seedPhotoUrl],
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
    ConditionExpression: 'attribute_not_exists(animalId)', // belt-and-suspenders against a race with the check above
  }));

  return item;
}

async function renameType(animalId, newName) {
  if (!newName || !newName.trim()) throw new Error('Name cannot be empty');

  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { animalId },
    ConditionExpression: 'attribute_exists(animalId)',
    UpdateExpression: 'SET #name = :name, updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#name': 'name' },
    ExpressionAttributeValues: { ':name': newName.trim(), ':updatedAt': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  })).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  });

  return result ? result.Attributes : null;
}

async function deleteTypeRecord(animalId) {
  // Deletes only the DynamoDB item. Actual S3 photo cleanup happens in the
  // Lambda handler, AFTER cross-referencing against every other type's
  // photos -- exactly the check that would have prevented the original
  // ranch-dogs/adoptable-dogs folder mixup if it had existed then.
  await ddb.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { animalId },
    ConditionExpression: 'attribute_exists(animalId)',
  })).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  });
}

/**
 * Returns the subset of `urls` that also appear in some OTHER type's photo
 * pool. Anything in this list must NOT be deleted from S3, even though it's
 * being removed from this type's array.
 */
async function findUrlsUsedByOtherTypes(urls, excludeAnimalId) {
  if (!urls || urls.length === 0) return [];
  const all = await listAll();
  const otherUrls = new Set();
  for (const animal of all) {
    if (animal.animalId === excludeAnimalId) continue;
    for (const url of animal.photos || []) otherUrls.add(url);
  }
  return urls.filter((url) => otherUrls.has(url));
}

async function addPhotos(animalId, newUrls) {
  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { animalId },
    ConditionExpression: 'attribute_exists(animalId)',
    UpdateExpression: 'SET photos = list_append(if_not_exists(photos, :empty), :newUrls), updatedAt = :updatedAt',
    ExpressionAttributeValues: { ':newUrls': newUrls, ':empty': [], ':updatedAt': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  })).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  });

  return result ? result.Attributes : null;
}

async function removePhoto(animalId, photoUrl) {
  const animal = await getById(animalId);
  if (!animal) return null;

  const photos = (animal.photos || []).filter((p) => p !== photoUrl);
  if (photos.length === (animal.photos || []).length) {
    throw new Error('That photo was not found on this animal type');
  }
  if (photos.length === 0) {
    throw new Error('Cannot remove the last photo — an animal type must always have at least one. Delete the whole type instead if it should go away.');
  }

  // If the removed photo was the thumbnail, fall back to the first
  // remaining photo so the homepage card never points at a dead image.
  const thumbnailUrl = animal.thumbnailUrl === photoUrl ? photos[0] : animal.thumbnailUrl;

  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { animalId },
    UpdateExpression: 'SET photos = :photos, thumbnailUrl = :thumbnailUrl, updatedAt = :updatedAt',
    ExpressionAttributeValues: { ':photos': photos, ':thumbnailUrl': thumbnailUrl, ':updatedAt': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  }));

  return result.Attributes;
}

async function setThumbnail(animalId, photoUrl) {
  const animal = await getById(animalId);
  if (!animal) return null;
  if (!(animal.photos || []).includes(photoUrl)) {
    throw new Error('That photo is not part of this animal type\'s pool');
  }

  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { animalId },
    UpdateExpression: 'SET thumbnailUrl = :thumbnailUrl, updatedAt = :updatedAt',
    ExpressionAttributeValues: { ':thumbnailUrl': photoUrl, ':updatedAt': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  }));

  return result.Attributes;
}

module.exports = {
  listAll,
  getById,
  createType,
  renameType,
  deleteTypeRecord,
  findUrlsUsedByOtherTypes,
  addPhotos,
  removePhoto,
  setThumbnail,
};
