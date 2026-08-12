// dynamo.js
// Admin CRUD for adoptable_animals. Photo pool + thumbnail picker works
// exactly like adminFarmAnimals/adminShop. Each animal is an individual
// record (unlike farm_animals, which groups permanent residents by
// species) -- name, type, age, sex, a free-text description, and an
// open-ended list of custom descriptors (breed, weight, whatever's
// relevant for that particular animal).

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.ADOPTABLE_ANIMALS_TABLE || 'adoptable_animals';

const VALID_AGE_UNITS = ['years', 'months'];
const VALID_SEX = ['Male', 'Female', 'Unknown'];

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeAge(age) {
  if (!age) return null;
  const value = Number(age.value);
  const unit = age.unit;
  if (!Number.isFinite(value) || value < 0) throw new Error('Age value must be a non-negative number');
  if (!VALID_AGE_UNITS.includes(unit)) throw new Error(`Age unit must be one of ${VALID_AGE_UNITS.join(', ')}`);
  return { value, unit };
}

function normalizeSex(sex) {
  if (!VALID_SEX.includes(sex)) throw new Error(`Sex must be one of ${VALID_SEX.join(', ')}`);
  return sex;
}

/**
 * Validates the custom descriptors list -- each entry needs a non-empty
 * label (e.g. "Breed", "Weight") and a value. Deliberately open-ended,
 * unlike age/sex/type -- this is exactly the field meant to hold
 * whatever's relevant for a specific animal that doesn't fit a fixed
 * schema (breed, weight, coat color, whatever the admin wants to note).
 */
function normalizeDescriptors(descriptors) {
  if (!Array.isArray(descriptors)) throw new Error('customDescriptors must be an array');
  return descriptors
    .filter((d) => d.label && d.label.trim())
    .map((d) => ({ label: d.label.trim(), value: (d.value || '').trim() }));
}

async function listAll() {
  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  return (result.Items || []).sort((a, b) => a.name.localeCompare(b.name));
}

async function getById(animalId) {
  const result = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { animalId } }));
  return result.Item || null;
}

async function createAnimal({ name, type, age, sex, description, customDescriptors, seedPhotoUrl }) {
  if (!name || !name.trim()) throw new Error('Name is required');
  if (!type || !type.trim()) throw new Error('Type is required');
  if (!seedPhotoUrl) throw new Error('At least one photo is required');

  const animalId = slugify(name);
  if (!animalId) throw new Error('Name must contain at least one letter or number');

  const existing = await getById(animalId);
  if (existing) throw new Error(`An animal with this name already exists (id: ${animalId})`);

  const now = new Date().toISOString();
  const item = {
    animalId,
    name: name.trim(),
    type: type.trim(),
    age: normalizeAge(age),
    sex: normalizeSex(sex),
    description: description ? description.trim() : '',
    customDescriptors: normalizeDescriptors(customDescriptors || []),
    photos: [seedPhotoUrl],
    thumbnailUrl: seedPhotoUrl,
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
    ConditionExpression: 'attribute_not_exists(animalId)',
  }));

  return item;
}

async function updateAnimal(animalId, fields) {
  const updates = [];
  const values = { ':updatedAt': new Date().toISOString() };
  const names = {};

  if (fields.name !== undefined) {
    if (!fields.name.trim()) throw new Error('Name cannot be empty');
    updates.push('#name = :name');
    names['#name'] = 'name';
    values[':name'] = fields.name.trim();
  }
  if (fields.type !== undefined) {
    if (!fields.type.trim()) throw new Error('Type cannot be empty');
    updates.push('#type = :type');
    names['#type'] = 'type';
    values[':type'] = fields.type.trim();
  }
  if (fields.age !== undefined) {
    updates.push('age = :age');
    values[':age'] = normalizeAge(fields.age);
  }
  if (fields.sex !== undefined) {
    updates.push('sex = :sex');
    values[':sex'] = normalizeSex(fields.sex);
  }
  if (fields.description !== undefined) {
    updates.push('description = :description');
    values[':description'] = fields.description.trim();
  }
  if (fields.customDescriptors !== undefined) {
    updates.push('customDescriptors = :customDescriptors');
    values[':customDescriptors'] = normalizeDescriptors(fields.customDescriptors);
  }
  updates.push('updatedAt = :updatedAt');

  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { animalId },
    ConditionExpression: 'attribute_exists(animalId)',
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

async function deleteAnimal(animalId) {
  const existing = await getById(animalId);
  if (!existing) return null;

  await ddb.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { animalId },
    ConditionExpression: 'attribute_exists(animalId)',
  }));

  return existing; // caller uses .photos to clean up S3
}

async function addPhoto(animalId, photoUrl) {
  const item = await getById(animalId);
  if (!item) return null;

  const photos = [...(item.photos || []), photoUrl];
  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { animalId },
    UpdateExpression: 'SET photos = :photos, updatedAt = :updatedAt',
    ExpressionAttributeValues: { ':photos': photos, ':updatedAt': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes;
}

async function removePhoto(animalId, photoUrl) {
  const item = await getById(animalId);
  if (!item) return null;

  const currentPhotos = item.photos || [];
  if (currentPhotos.length <= 1) {
    throw new Error('Cannot remove the last photo -- an animal must have at least one.');
  }

  const photos = currentPhotos.filter((p) => p !== photoUrl);
  const thumbnailUrl = item.thumbnailUrl === photoUrl ? photos[0] : item.thumbnailUrl;

  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { animalId },
    UpdateExpression: 'SET photos = :photos, thumbnailUrl = :thumbnailUrl, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':photos': photos,
      ':thumbnailUrl': thumbnailUrl,
      ':updatedAt': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes;
}

async function setThumbnail(animalId, photoUrl) {
  const item = await getById(animalId);
  if (!item) return null;
  if (!(item.photos || []).includes(photoUrl)) {
    throw new Error("That photo is not part of this animal's photo pool.");
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
  VALID_AGE_UNITS,
  VALID_SEX,
  listAll,
  getById,
  createAnimal,
  updateAnimal,
  deleteAnimal,
  addPhoto,
  removePhoto,
  setThumbnail,
};
