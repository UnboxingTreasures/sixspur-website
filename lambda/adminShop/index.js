// index.js
// Admin routes for managing shop products:
//   GET    /admin/shop                    — list all
//   GET    /admin/shop/{id}                — one product's full detail
//   POST   /admin/shop                     — create (requires seedPhotoUrl, already uploaded)
//   PATCH  /admin/shop/{id}                — edit any fields, including switching hasVariants on/off
//   DELETE /admin/shop/{id}                — delete, removes ALL its photos from S3
//   POST   /admin/shop/{id}/photos/presign — presigned upload URL for a new photo
//   POST   /admin/shop/{id}/photos         — add already-uploaded photo(s) to the pool
//   DELETE /admin/shop/{id}/photos         — remove one photo (body: { photoUrl })
//   PATCH  /admin/shop/{id}/thumbnail      — set which pool photo is the main product image
//
// AUTH: every route here requires a verified JWT (via the same
// authorizer protecting /donor/* and /donate/*) AND isAdmin=true on
// the donor record -- see requireAdmin() in adminAuth.js. This includes
// the photos/presign route -- an unauthenticated presign endpoint would
// let anyone upload arbitrary files into the bucket under any itemId.

const {
  listAll, getById, createItem, updateItem, deleteItem,
  addPhotos, removePhoto, setThumbnail,
} = require('./dynamo');
const { createPresignedUploadUrl, deletePhoto } = require('./s3');
const { requireAdmin } = require('./adminAuth');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function handleList() {
  const items = await listAll();
  return respond(200, { items });
}

async function handleDetail(itemId) {
  const item = await getById(itemId);
  if (!item) return respond(404, { error: 'Product not found' });
  return respond(200, item);
}

async function handleCreate(body) {
  try {
    const created = await createItem(body);
    return respond(201, created);
  } catch (err) {
    return respond(400, { error: err.message });
  }
}

async function handleUpdate(itemId, body) {
  let updated;
  try {
    updated = await updateItem(itemId, body);
  } catch (err) {
    return respond(400, { error: err.message });
  }
  if (!updated) return respond(404, { error: 'Product not found' });
  return respond(200, updated);
}

async function handleDelete(itemId) {
  const deleted = await deleteItem(itemId);
  if (!deleted) return respond(404, { error: 'Product not found' });

  const photos = deleted.photos || [];
  const failures = [];
  for (const url of photos) {
    try {
      await deletePhoto(url);
    } catch (err) {
      console.error(`Failed to delete photo for ${itemId}: ${url}`, err);
      failures.push(url);
    }
  }

  return respond(200, { success: true, deletedItemId: itemId, photosDeleted: photos.length - failures.length, photosFailedToDelete: failures });
}

async function handlePresign(itemId, body) {
  const fileName = body.fileName;
  if (!fileName) return respond(400, { error: 'fileName is required' });

  const { uploadUrl, cdnUrl } = await createPresignedUploadUrl(itemId, fileName);
  return respond(200, { uploadUrl, cdnUrl });
}

async function handleAddPhotos(itemId, body) {
  const urls = Array.isArray(body.photoUrls) ? body.photoUrls : [];
  if (urls.length === 0) return respond(400, { error: 'photoUrls must be a non-empty array' });

  const updated = await addPhotos(itemId, urls);
  if (!updated) return respond(404, { error: 'Product not found' });
  return respond(200, updated);
}

async function handleRemovePhoto(itemId, body) {
  if (!body.photoUrl) return respond(400, { error: 'photoUrl is required' });

  let updated;
  try {
    updated = await removePhoto(itemId, body.photoUrl);
  } catch (err) {
    return respond(400, { error: err.message });
  }
  if (!updated) return respond(404, { error: 'Product not found' });

  try {
    await deletePhoto(body.photoUrl);
  } catch (err) {
    console.error(`Failed to delete photo from S3 (record was still updated): ${body.photoUrl}`, err);
  }

  return respond(200, updated);
}

async function handleSetThumbnail(itemId, body) {
  if (!body.photoUrl) return respond(400, { error: 'photoUrl is required' });

  let updated;
  try {
    updated = await setThumbnail(itemId, body.photoUrl);
  } catch (err) {
    return respond(400, { error: err.message });
  }
  if (!updated) return respond(404, { error: 'Product not found' });
  return respond(200, updated);
}

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, {});
  }

  const auth = await requireAdmin(event);
  if (!auth.authorized) {
    return respond(auth.statusCode, { error: auth.error });
  }

  const itemId = event.pathParameters?.id;
  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return respond(400, { error: 'Invalid JSON body' });
    }
  }

  try {
    switch (event.routeKey) {
      case 'GET /admin/shop':                    return await handleList();
      case 'GET /admin/shop/{id}':                return await handleDetail(itemId);
      case 'POST /admin/shop':                    return await handleCreate(body);
      case 'PATCH /admin/shop/{id}':              return await handleUpdate(itemId, body);
      case 'DELETE /admin/shop/{id}':             return await handleDelete(itemId);
      case 'POST /admin/shop/{id}/photos/presign': return await handlePresign(itemId, body);
      case 'POST /admin/shop/{id}/photos':        return await handleAddPhotos(itemId, body);
      case 'DELETE /admin/shop/{id}/photos':      return await handleRemovePhoto(itemId, body);
      case 'PATCH /admin/shop/{id}/thumbnail':    return await handleSetThumbnail(itemId, body);
      default:
        return respond(404, { error: `No handler for route: ${event.routeKey}` });
    }
  } catch (err) {
    console.error('Admin shop request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
