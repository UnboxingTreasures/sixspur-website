// index.js
// Admin routes for managing farm animal types:
//   GET    /admin/animals                    — list all types (with photos)
//   GET    /admin/animals/{id}                — one type's full detail
//   POST   /admin/animals                     — create a new type (requires seedPhotoUrl,
//                                                already uploaded via the presign route below)
//   PATCH  /admin/animals/{id}                — rename (name only -- typo fixes)
//   DELETE /admin/animals/{id}                — delete the whole type, recursively removing
//                                                its photos from S3 EXCEPT any still used by
//                                                another type
//   POST   /admin/animals/{id}/photos/presign — get a presigned upload URL for a new photo
//   POST   /admin/animals/{id}/photos         — add already-uploaded photo(s) to the pool
//   DELETE /admin/animals/{id}/photos         — remove one photo (body: { photoUrl })
//   PATCH  /admin/animals/{id}/thumbnail      — set which pool photo is the homepage thumbnail

const {
  listAll, getById, createType, renameType, deleteTypeRecord,
  findUrlsUsedByOtherTypes, addPhotos, removePhoto, setThumbnail,
} = require('./dynamo');
const { createPresignedUploadUrl, deletePhoto } = require('./s3');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
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
  if (!animal) return respond(404, { error: 'Animal type not found' });
  return respond(200, animal);
}

async function handleCreate(body) {
  if (!body.name) return respond(400, { error: 'name is required' });
  if (!body.seedPhotoUrl) return respond(400, { error: 'seedPhotoUrl is required — every animal type needs at least one photo' });

  try {
    const created = await createType({ name: body.name, description: body.description, seedPhotoUrl: body.seedPhotoUrl });
    return respond(201, created);
  } catch (err) {
    return respond(400, { error: err.message });
  }
}

async function handleRename(animalId, body) {
  if (!body.name) return respond(400, { error: 'name is required' });

  try {
    const updated = await renameType(animalId, body.name);
    if (!updated) return respond(404, { error: 'Animal type not found' });
    return respond(200, updated);
  } catch (err) {
    return respond(400, { error: err.message });
  }
}

async function handleDelete(animalId) {
  const animal = await getById(animalId);
  if (!animal) return respond(404, { error: 'Animal type not found' });

  const photos = animal.photos || [];
  const protectedUrls = await findUrlsUsedByOtherTypes(photos, animalId);
  const safeToDelete = photos.filter((url) => !protectedUrls.includes(url));

  const failures = [];
  for (const url of safeToDelete) {
    try {
      await deletePhoto(url);
    } catch (err) {
      console.error(`Failed to delete photo from S3: ${url}`, err);
      failures.push(url);
    }
  }

  await deleteTypeRecord(animalId);

  return respond(200, {
    success: true,
    deletedType: animalId,
    photosDeleted: safeToDelete.length - failures.length,
    photosSkipped: protectedUrls.length, // still used by another type -- left alone
    photosFailedToDelete: failures,
  });
}

async function handlePresign(animalId, body) {
  const fileName = body.fileName;
  if (!fileName) return respond(400, { error: 'fileName is required' });

  const { uploadUrl, cdnUrl } = await createPresignedUploadUrl(animalId, fileName);
  return respond(200, { uploadUrl, cdnUrl });
}

async function handleAddPhotos(animalId, body) {
  const urls = Array.isArray(body.photoUrls) ? body.photoUrls : [];
  if (urls.length === 0) return respond(400, { error: 'photoUrls must be a non-empty array' });

  const updated = await addPhotos(animalId, urls);
  if (!updated) return respond(404, { error: 'Animal type not found' });
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
  if (!updated) return respond(404, { error: 'Animal type not found' });

  // Only delete from S3 if no other type also uses this exact photo.
  const stillUsedElsewhere = await findUrlsUsedByOtherTypes([body.photoUrl], animalId);
  if (stillUsedElsewhere.length === 0) {
    try {
      await deletePhoto(body.photoUrl);
    } catch (err) {
      console.error(`Failed to delete photo from S3 (record was still updated): ${body.photoUrl}`, err);
    }
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
  if (!updated) return respond(404, { error: 'Animal type not found' });
  return respond(200, updated);
}

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, {});
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
      case 'GET /admin/animals':                    return await handleList();
      case 'GET /admin/animals/{id}':                return await handleDetail(animalId);
      case 'POST /admin/animals':                    return await handleCreate(body);
      case 'PATCH /admin/animals/{id}':              return await handleRename(animalId, body);
      case 'DELETE /admin/animals/{id}':             return await handleDelete(animalId);
      case 'POST /admin/animals/{id}/photos/presign': return await handlePresign(animalId, body);
      case 'POST /admin/animals/{id}/photos':        return await handleAddPhotos(animalId, body);
      case 'DELETE /admin/animals/{id}/photos':      return await handleRemovePhoto(animalId, body);
      case 'PATCH /admin/animals/{id}/thumbnail':    return await handleSetThumbnail(animalId, body);
      default:
        return respond(404, { error: `No handler for route: ${event.routeKey}` });
    }
  } catch (err) {
    console.error('Admin animals request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
