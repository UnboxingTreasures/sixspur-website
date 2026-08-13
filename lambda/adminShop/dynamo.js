// dynamo.js
// Admin CRUD for shop_items. Photo pool management mirrors farm_animals
// (add/remove/thumbnail-pick from a pool).
//
// UPDATED: replaced the old fixed-list size system (hasSizes/sizes,
// limited to a hardcoded VALID_SIZES=[S,M,L,XL,2XL,3XL]) with a fully
// custom variant system. A product can now have ONE admin-defined
// variant dimension -- a label (e.g. "Size" or "Style") plus whatever
// option values the admin wants (e.g. S/M/L/XL for Size, or
// Red/Blue/Green for Style on hats), each with its own stock count.
// Not a multi-dimensional matrix (Size AND Color at once) -- one
// dimension per product, matching what was actually asked for.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.SHOP_ITEMS_TABLE || 'shop_items';

function validateVariants(variantLabel, variants) {
  if (!variantLabel || !variantLabel.trim()) {
    throw new Error('variantLabel is required when hasVariants is true (e.g. "Size" or "Style")');
  }
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error('variants must be a non-empty array when hasVariants is true');
  }
  const seen = new Set();
  for (const entry of variants) {
    if (!entry.value || !entry.value.trim()) {
      throw new Error('Each variant needs a non-empty value (e.g. "S" or "Red")');
    }
    if (seen.has(entry.value)) {
      throw new Error(`Duplicate variant value "${entry.value}"`);
    }
    seen.add(entry.value);
    if (typeof entry.stock !== 'number' || entry.stock < 0) {
      throw new Error(`Invalid stock for "${entry.value}" -- must be a non-negative number`);
    }
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

async function createItem({ name, description, price, category, seedPhotoUrl, hasVariants, variantLabel, variants, stock }) {
  if (!name || !name.trim()) throw new Error('Name is required');
  if (typeof price !== 'number' || price < 0) throw new Error('Price must be a non-negative number');
  if (!category || !category.trim()) throw new Error('Category is required');
  if (!seedPhotoUrl) throw new Error('An image is required');

  const itemId = slugify(name);
  if (!itemId) throw new Error('Name must contain at least one letter or number');

  const existing = await getById(itemId);
  if (existing) throw new Error(`A product with this name already exists (id: ${itemId})`);

  if (hasVariants) {
    validateVariants(variantLabel, variants);
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
    ...(hasVariants ? { variantLabel: variantLabel.trim(), variants } : { stock: typeof stock === 'number' ? stock : 0 }),
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
 * Switching hasVariants on/off is allowed -- e.g. turning a simple
 * product into a variant one, or vice versa -- the caller must provide
 * the corresponding variantLabel+variants or stock number when doing so.
 * Admin can also just edit variantLabel/variants on an already-variant
 * product at any time -- add a size, remove a color, rename the
 * dimension label entirely.
 */
async function updateItem(itemId, { name, description, price, category, imageUrl, hasVariants, variantLabel, variants, stock }) {
  const existing = await getById(itemId);
  if (!existing) return null;

  if (hasVariants === true) {
    validateVariants(variantLabel, variants);
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
      // Switching TO variants: set label + variants array, drop the old single stock count.
      setClauses.push('variantLabel = :variantLabel');
      values[':variantLabel'] = variantLabel.trim();
      setClauses.push('variants = :variants');
      values[':variants'] = variants;
      removeClauses.push('stock');
    } else {
      // Switching AWAY from variants: set a single stock count, drop label + variants array.
      setClauses.push('stock = :stock');
      values[':stock'] = typeof stock === 'number' ? stock : (existing.stock ?? 0);
      removeClauses.push('variantLabel');
      removeClauses.push('variants');
    }
  } else if (variants !== undefined && existing.hasVariants) {
    // Not switching modes, just updating variant values/stock on an already-variant product.
    validateVariants(variantLabel !== undefined ? variantLabel : existing.variantLabel, variants);
    setClauses.push('variants = :variants');
    values[':variants'] = variants;
    if (variantLabel !== undefined) {
      setClauses.push('variantLabel = :variantLabel');
      values[':variantLabel'] = variantLabel.trim();
    }
  } else if (variantLabel !== undefined && existing.hasVariants && variants === undefined) {
    // Renaming the dimension label only (e.g. "Size" -> "Sizing"), variants unchanged.
    if (!variantLabel.trim()) throw new Error('variantLabel cannot be empty');
    setClauses.push('variantLabel = :variantLabel');
    values[':variantLabel'] = variantLabel.trim();
  } else if (stock !== undefined && !existing.hasVariants) {
    // Not switching modes, just updating the single stock count.
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
