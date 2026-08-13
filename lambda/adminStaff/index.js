// index.js
// Admin routes for managing staff:
//   GET    /admin/staff                    — list all
//   GET    /admin/staff/{id}                — one staff member
//   POST   /admin/staff                     — create (requires imageUrl, already uploaded)
//   PATCH  /admin/staff/{id}                — edit name/title/bio, optionally imageUrl
//   DELETE /admin/staff/{id}                — delete, removes their photo from S3
//   POST   /admin/staff/{id}/photo/presign  — presigned upload URL for a new/replacement photo
//
// AUTH: every route here requires a verified JWT (via the same
// authorizer protecting /donor/* and /donate/*) AND isAdmin=true on
// the donor record -- see requireAdmin() in adminAuth.js. This includes
// the photo/presign route -- an unauthenticated presign endpoint would
// let anyone upload arbitrary files into the bucket under any staffId.

const { listAll, getById, createStaffMember, updateStaffMember, deleteStaffMember } = require('./dynamo');
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
  const staff = await listAll();
  return respond(200, { staff });
}

async function handleDetail(staffId) {
  const member = await getById(staffId);
  if (!member) return respond(404, { error: 'Staff member not found' });
  return respond(200, member);
}

async function handleCreate(body) {
  try {
    const created = await createStaffMember(body);
    return respond(201, created);
  } catch (err) {
    return respond(400, { error: err.message });
  }
}

async function handleUpdate(staffId, body) {
  // If a new photo was uploaded, delete the old one from S3 after the
  // update succeeds, so a person is never left with two orphaned photos
  // lingering in the bucket.
  const existing = await getById(staffId);
  if (!existing) return respond(404, { error: 'Staff member not found' });

  let updated;
  try {
    updated = await updateStaffMember(staffId, body);
  } catch (err) {
    return respond(400, { error: err.message });
  }
  if (!updated) return respond(404, { error: 'Staff member not found' });

  if (body.imageUrl && body.imageUrl !== existing.imageUrl && existing.imageUrl) {
    try {
      await deletePhoto(existing.imageUrl);
    } catch (err) {
      console.error(`Failed to delete old photo for ${staffId}:`, err);
    }
  }

  return respond(200, updated);
}

async function handleDelete(staffId) {
  const deleted = await deleteStaffMember(staffId);
  if (!deleted) return respond(404, { error: 'Staff member not found' });

  if (deleted.imageUrl) {
    try {
      await deletePhoto(deleted.imageUrl);
    } catch (err) {
      console.error(`Failed to delete photo for ${staffId}:`, err);
    }
  }

  return respond(200, { success: true, deletedStaffId: staffId });
}

async function handlePresign(staffId, body) {
  const fileName = body.fileName;
  if (!fileName) return respond(400, { error: 'fileName is required' });

  const { uploadUrl, cdnUrl } = await createPresignedUploadUrl(staffId, fileName);
  return respond(200, { uploadUrl, cdnUrl });
}

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, {});
  }

  const auth = await requireAdmin(event);
  if (!auth.authorized) {
    return respond(auth.statusCode, { error: auth.error });
  }

  const staffId = event.pathParameters?.id;
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
      case 'GET /admin/staff':                    return await handleList();
      case 'GET /admin/staff/{id}':                return await handleDetail(staffId);
      case 'POST /admin/staff':                    return await handleCreate(body);
      case 'PATCH /admin/staff/{id}':              return await handleUpdate(staffId, body);
      case 'DELETE /admin/staff/{id}':             return await handleDelete(staffId);
      case 'POST /admin/staff/{id}/photo/presign': return await handlePresign(staffId, body);
      default:
        return respond(404, { error: `No handler for route: ${event.routeKey}` });
    }
  } catch (err) {
    console.error('Admin staff request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
