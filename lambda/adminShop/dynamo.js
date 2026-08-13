// dynamo.js
// Admin CRUD for shop_items. Photo pool management mirrors farm_animals
// (add/remove/thumbnail-pick from a pool).
//
// FULL REWRITE for multi-dimension variants: a product can now have
// MULTIPLE variant dimensions at once (e.g. Size AND Color together),
// not just one. Stock is tracked per exact COMBINATION (e.g. "Medium +
// Red" has its own stock number, distinct from "Medium + Blue") -- this
// is a true Cartesian product across all declared dimensions, not
// independent lists. Photos are simpler: they're assigned to the FIRST
// dimension's values only (variantPhotos, keyed by that dimension's
// value), matching how most real stores actually work -- picking a
// color changes the photo, picking a size usually doesn't. The admin
// frontend is responsible for regenerating the full combinations array
// whenever dimensions/values change; this backend just validates that
// what it's given is actually a complete, valid Cartesian product.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.SHOP_ITEMS_TABLE || 'shop_items';

/**
 * Validates variantDimensions + combinations together. Rather than
 * explicitly enumerate every expected combination and compare, this
 * checks that (a) the combinations count matches the expected Cartesian
 * product size for the declared dimensions, and (b) every combination
 * has exactly one valid value per dimension with no duplicates -- those
 * two checks together guarantee completeness and correctness.
 */
function validateVariantDimensions(dimensions, combinations) {
  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    throw new Error('variantDimensions must be a non-empty array when hasVariants is true');
  }
  for (const dim of dimensions) {
    if (!dim.label || !dim.label.trim()) {
      throw new Error('Each variant dimension needs a non-empty label (e.g. "Size" or "Color")');
    }
    if (!Array.isArray(dim.values) || dim.values.length === 0) {
      throw new Error(`Dimension "${dim.label}" needs at least one value`);
    }
    const seenValues = new Set();
    for (const v of dim.values) {
      if (!v || !v.trim()) throw new Error(`Dimension "${dim.label}" has an empty value`);
      if (seenValues.has(v)) throw new Error(`Dimension "${dim.label}" has duplicate value "${v}"`);
      seenValues.add(v);
    }
  }

  const expectedCount = dimensions.reduce((acc, d) => acc * d.values.length, 1);
  if (!Array.isArray(combinations) || combinations.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} combinations for these dimensions (one per Cartesian product entry), got ${combinations ? combinations.length : 0}`);
  }

  const seenKeys = new Set();
  for (const combo of combinations) {
    if (typeof combo.stock !== 'number' || combo.stock < 0) {
      throw new Error('Every combination needs a non-negative stock number');
    }
    const keyParts = [];
    for (const dim of dimensions) {
      const val = combo.values ? combo.values[dim.label] : undefined;
      if (!dim.values.includes(val)) {
        throw new Error(`Invalid or missing value for dimension "${dim.label}" in a combination`);
      }
      keyParts.push(val);
    }
    const key = keyParts.join('|');
    if (seenKeys.has(key)) throw new Error(`Duplicate combination: ${keyParts.join(' + ')}`);
    seenKeys.add(key);
  }
}

async function listAll() {
  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  return (result.Items || []).sort((a, b) => a.name.localeCompare(b.name));
}

async function getById(itemId) {
  const result = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { itemId } }));
  return result.Item || null;
}

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function createItem({ name, description, price, category, seedPhotoUrl, hasVariants, variantDimensions, combinations, variantPhotos, stock }) {
  if (!name || !name.trim()) throw new Error('Name is required');
  if (typeof price !== 'number' || price < 0) throw new Error('Price must be a non-negative number');
  if (!category || !category.trim()) throw new Error('Category is required');
  if (!seedPhotoUrl) throw new Error('An image is required');

  const itemId = slugify(name);
  if (!itemId) throw new Error('Name must contain at least one letter or number');

  const existing = await getById(itemId);
  if (existing) throw new Error(`A product with this name already exists (id: ${itemId})`);

  if (hasVariants) {
    validateVariantDimensions(variantDimensions, combinations);
  }

  const now = new Date().toISOString();
  const item = {
    itemId,
    name: name.trim(),
    description: description ? description.trim() : '',
    price,
    category: category.trim(),
    photos: [seedPhotoUrl],
    thumbnailUrl: seedPhotoUrl,
    hasVariants: Boolean(hasVariants),
    ...(hasVariants
      ? { variantDimensions, combinations, variantPhotos: variantPhotos || {} }
      : { stock: typeof stock === 'number' ? stock : 0 }),
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
    ConditionExpression: 'attribute_not_exists(itemId)',
  }));

  return item;
}

/**
 * Updates any combination of fields. itemId (the slug) never changes even
 * if name is edited, same convention as farm_animals/staff_members.
 * Switching hasVariants on/off is allowed. When editing an already-variant
 * product's dimensions/combinations, the frontend always sends the FULL,
 * regenerated combinations array (not a partial patch) -- this backend
 * just validates and stores whatever complete set it's given.
 */
async function updateItem(itemId, { name, description, price, category, imageUrl, hasVariants, variantDimensions, combinations, variantPhotos, stock }) {
  const existing = await getById(itemId);
  if (!existing) return null;

  if (hasVariants === true) {
    validateVariantDimensions(variantDimensions, combinations);
  }

  const setClauses = [];
  const removeClauses = [];
  const values = { ':updatedAt': new Date().toISOString() };
  const names = {};
  setClauses.push('updatedAt = :updatedAt');

  if (name !== undefined) {
    if (!name.trim()) throw new Error('Name cannot be empty');
    setClauses.push('#name = :name');
    names['#name'] = 'name';
    values[':name'] = name.trim();
  }
  if (description !== undefined) {
    setClauses.push('description = :description');
    values[':description'] = description.trim();
  }
  if (price !== undefined) {
    if (typeof price !== 'number' || price < 0) throw new Error('Price must be a non-negative number');
    setClauses.push('price = :price');
    values[':price'] = price;
  }
  if (category !== undefined) {
    if (!category.trim()) throw new Error('Category cannot be empty');
    setClauses.push('category = :category');
    values[':category'] = category.trim();
  }
  if (imageUrl !== undefined) {
    setClauses.push('thumbnailUrl = :imageUrl');
    values[':imageUrl'] = imageUrl;
  }

  if (hasVariants !== undefined) {
    setClauses.push('hasVariants = :hasVariants');
    values[':hasVariants'] = Boolean(hasVariants);
    if (hasVariants) {
      setClauses.push('variantDimensions = :variantDimensions, combinations = :combinations, variantPhotos = :variantPhotos');
      values[':variantDimensions'] = variantDimensions;
      values[':combinations'] = combinations;
      values[':variantPhotos'] = variantPhotos || {};
      removeClauses.push('stock');
    } else {
      setClauses.push('stock = :stock');
      values[':stock'] = typeof stock === 'number' ? stock : (existing.stock ?? 0);
      removeClauses.push('variantDimensions');
      removeClauses.push('combinations');
      removeClauses.push('variantPhotos');
    }
  } else if ((combinations !== undefined || variantPhotos !== undefined) && existing.hasVariants) {
    // Not switching modes, just updating dimensions/combinations/photos
    // on an already-variant product -- e.g. admin added a new size,
    // removed a color, or reassigned photos.
    const dims = variantDimensions !== undefined ? variantDimensions : existing.variantDimensions;
    const combos = combinations !== undefined ? combinations : existing.combinations;
    validateVariantDimensions(dims, combos);
    setClauses.push('variantDimensions = :variantDimensions, combinations = :combinations');
    values[':variantDimensions'] = dims;
    values[':combinations'] = combos;
    if (variantPhotos !== undefined) {
      setClauses.push('variantPhotos = :variantPhotos');
      values[':variantPhotos'] = variantPhotos;
    }
  } else if (stock !== undefined && !existing.hasVariants) {
    setClauses.push('stock = :stock');
    values[':stock'] = stock;
  }

  let updateExpression = `SET ${setClauses.join(', ')}`;
  if (removeClauses.length > 0) {
    updateExpression += ` REMOVE ${removeClauses.join(', ')}`;
  }

  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { itemId },
    ConditionExpression: 'attribute_exists(itemId)',
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: values,
    ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
    ReturnValues: 'ALL_NEW',
  })).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  });

  return result ? result.Attributes : null;
}

async function deleteItem(itemId) {
  const existing = await getById(itemId);
  if (!existing) return null;

  await ddb.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { itemId },
    ConditionExpression: 'attribute_exists(itemId)',
  }));

  return existing; // caller uses this to clean up all its photos in S3
}

// ── Photo pool management (mirrors farm_animals) ────────────────────────

async function addPhotos(itemId, newUrls) {
  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { itemId },
    ConditionExpression: 'attribute_exists(itemId)',
    UpdateExpression: 'SET photos = list_append(if_not_exists(photos, :empty), :newUrls), updatedAt = :updatedAt',
    ExpressionAttributeValues: { ':newUrls': newUrls, ':empty': [], ':updatedAt': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  })).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  });

  return result ? result.Attributes : null;
}

async function removePhoto(itemId, photoUrl) {
  const item = await getById(itemId);
  if (!item) return null;

  const photos = (item.photos || []).filter((p) => p !== photoUrl);
  if (photos.length === (item.photos || []).length) {
    throw new Error('That photo was not found on this product');
  }
  if (photos.length === 0) {
    throw new Error('Cannot remove the last photo — a product must always have at least one. Delete the whole product instead if it should go away.');
  }

  const thumbnailUrl = item.thumbnailUrl === photoUrl ? photos[0] : item.thumbnailUrl;

  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { itemId },
    UpdateExpression: 'SET photos = :photos, thumbnailUrl = :thumbnailUrl, updatedAt = :updatedAt',
    ExpressionAttributeValues: { ':photos': photos, ':thumbnailUrl': thumbnailUrl, ':updatedAt': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  }));

  return result.Attributes;
}

async function setThumbnail(itemId, photoUrl) {
  const item = await getById(itemId);
  if (!item) return null;
  if (!(item.photos || []).includes(photoUrl)) {
    throw new Error('That photo is not part of this product\'s pool');
  }

  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { itemId },
    UpdateExpression: 'SET thumbnailUrl = :thumbnailUrl, updatedAt = :updatedAt',
    ExpressionAttributeValues: { ':thumbnailUrl': photoUrl, ':updatedAt': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  }));

  return result.Attributes;
}

module.exports = {
  listAll,
  getById,
  createItem,
  updateItem,
  deleteItem,
  addPhotos,
  removePhoto,
  setThumbnail,
};
