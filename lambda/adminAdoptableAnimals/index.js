// index.js
// Admin routes for managing adoptable animals:
//   GET    /admin/adoptable-animals                     — list all
//   GET    /admin/adoptable-animals/{id}                 — one animal
//   POST   /admin/adoptable-animals                      — create (requires seedPhotoUrl, already uploaded)
//   PATCH  /admin/adoptable-animals/{id}                 — edit any fields
//   DELETE /admin/adoptable-animals/{id}                 — delete, removes ALL its photos from S3
//   POST   /admin/adoptable-animals/{id}/photos/presign  — presigned upload URL for a new photo
//   POST   /admin/adoptable-animals/{id}/photos          — add already-uploaded photo(s) to the pool
//   DELETE /admin/adoptable-animals/{id}/photos          — remove one photo (body: { photoUrl })
//   PATCH  /admin/adoptable-animals/{id}/thumbnail        — set which pool photo is the main photo
//
// AUTH: every route here requires a verified JWT (via the same
// authorizer protecting /donor/* and /donate/*) AND isAdmin=true on
// the donor record -- see requireAdmin() in adminAuth.js. This includes
// the photos/presign route -- an unauthenticated presign endpoint would
// let anyone upload arbitrary files into the bucket under any animalId.

const {
  listAll, getById, createAnimal, updateAnimal, deleteAnimal,
  addPhoto, removePhoto, setThumbnail,
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
  const animals = await listAll();
  return respond(200, { animals });
}

async function handleDetail(animalId) {
  const animal = await getById(animalId);
  if (!animal) return respond(404, { error: 'Animal not found' });
  return respond(200, animal);
}

async function handleCreate(body) {
  try {
    const created = await createAnimal(body);
    return respond(201, created);
  } catch (err) {
    return respond(400, { error: err.message });
  }
}

async function handleUpdate(animalId, body) {
  let updated;
  try {
    updated = await updateAnimal(animalId, body);
  } catch (err) {
    return respond(400, { error: err.message });
  }
  if (!updated) return respond(404, { error: 'Animal not found' });
  return respond(200, updated);
}

async function handleDelete(animalId) {
  const deleted = await deleteAnimal(animalId);
  if (!deleted) return respond(404, { error: 'Animal not found' });

  for (const photoUrl of deleted.photos || []) {
    try {
      await deletePhoto(photoUrl);
    } catch (err) {
      console.error(`Failed to delete photo for ${animalId}:`, err);
    }
  }

  return respond(200, { success: true, deletedAnimalId: animalId });
}

async function handlePresign(animalId, body) {
  const fileName = body.fileName;
  if (!fileName) return respond(400, { error: 'fileName is required' });
  const { uploadUrl, cdnUrl } = await createPresignedUploadUrl(animalId, fileName);
  return respond(200, { uploadUrl, cdnUrl });
}

async function handleAddPhoto(animalId, body) {
  const urls = body.photoUrls;
  if (!Array.isArray(urls) || urls.length === 0) {
    return respond(400, { error: 'photoUrls must be a non-empty array' });
  }
  let updated = null;
  for (const url of urls) {
    updated = await addPhoto(animalId, url);
    if (!updated) return respond(404, { error: 'Animal not found' });
  }
  return respond(200, updated);
}

async function handleRemovePhoto(animalId, body) {
  if (!body.photoUrl) return respond(400, { error: 'photoUrl is required' });

  let updated;
  try {
    updated = await removePhoto(animalId, body.photoUrl);
  } catch (err) {
    return respond(400, { error: err.message });
  }
  if (!updated) return respond(404, { error: 'Animal not found' });

  try {
    await deletePhoto(body.photoUrl);
  } catch (err) {
    console.error(`Failed to delete photo from S3 for ${animalId}:`, err);
  }

  return respond(200, updated);
}

async function handleSetThumbnail(animalId, body) {
  if (!body.photoUrl) return respond(400, { error: 'photoUrl is required' });

  let updated;
  try {
    updated = await setThumbnail(animalId, body.photoUrl);
  } catch (err) {
    return respond(400, { error: err.message });
  }
  if (!updated) return respond(404, { error: 'Animal not found' });
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

  const animalId = event.pathParameters?.id;
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
      case 'GET /admin/adoptable-animals':                    return await handleList();
      case 'GET /admin/adoptable-animals/{id}':                return await handleDetail(animalId);
      case 'POST /admin/adoptable-animals':                    return await handleCreate(body);
      case 'PATCH /admin/adoptable-animals/{id}':              return await handleUpdate(animalId, body);
      case 'DELETE /admin/adoptable-animals/{id}':             return await handleDelete(animalId);
      case 'POST /admin/adoptable-animals/{id}/photos/presign': return await handlePresign(animalId, body);
      case 'POST /admin/adoptable-animals/{id}/photos':        return await handleAddPhoto(animalId, body);
      case 'DELETE /admin/adoptable-animals/{id}/photos':      return await handleRemovePhoto(animalId, body);
      case 'PATCH /admin/adoptable-animals/{id}/thumbnail':    return await handleSetThumbnail(animalId, body);
      default:
        return respond(404, { error: `No handler for route: ${event.routeKey}` });
    }
  } catch (err) {
    console.error('Admin adoptable animals request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
