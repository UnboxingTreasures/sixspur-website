// index.js
// Three routes for the admin Adoptions page:
//   GET   /admin/adoptions        — list applications, optional ?status= filter
//   GET   /admin/adoptions/{id}   — single application detail + presigned PDF link
//   PATCH /admin/adoptions/{id}   — change status; on success, emails the applicant
//
// AUTH: every route here requires a verified JWT (via the same
// authorizer protecting /donor/* and /donate/*) AND isAdmin=true on
// the donor record -- see requireAdmin() in adminAuth.js. Especially
// important here: applications carry applicant contact info, addresses,
// and fence/enclosure photos -- real personal data, not just content.

const { listByStatus, listAll, getById, updateStatus } = require('./dynamo');
const { getPresignedDownloadUrl, getPresignedFencePhotoUrls } = require('./s3');
const { notifyApplicantOfStatusChange } = require('./notifyApplicant');
const { requireAdmin } = require('./adminAuth');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,PATCH,OPTIONS',
};
function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
async function handleList(event) {
  const status = event.queryStringParameters?.status;
  const items = status ? await listByStatus(status) : await listAll();
  return respond(200, { applications: items });
}
async function handleDetail(applicationId) {
  const application = await getById(applicationId);
  if (!application) return respond(404, { error: 'Application not found' });
  let pdfDownloadUrl = null;
  if (application.pdfKey) {
    pdfDownloadUrl = await getPresignedDownloadUrl(application.pdfKey);
  }
  const fencePhotos = await getPresignedFencePhotoUrls(application.fencePhotoKeys);
  return respond(200, { ...application, pdfDownloadUrl, fencePhotos });
}
async function handleUpdateStatus(applicationId, body) {
  if (!body.status) return respond(400, { error: 'status is required' });
  let updated;
  try {
    updated = await updateStatus(applicationId, body.status);
  } catch (err) {
    return respond(400, { error: err.message });
  }
  if (!updated) return respond(404, { error: 'Application not found' });
  // Applicant notification failure shouldn't roll back or fail the status
  // change itself -- the status update already succeeded by this point.
  try {
    await notifyApplicantOfStatusChange({
      status: body.status,
      firstName: updated.firstName,
      primaryEmail: updated.primaryEmail,
      interestedIn: updated.interestedIn,
    });
  } catch (err) {
    console.error('Failed to notify applicant of status change:', err);
  }
  return respond(200, { application: updated });
}
exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, {});
  }

  const auth = await requireAdmin(event);
  if (!auth.authorized) {
    return respond(auth.statusCode, { error: auth.error });
  }

  const applicationId = event.pathParameters?.id;
  try {
    if (event.routeKey === 'GET /admin/adoptions') {
      return await handleList(event);
    }
    if (event.routeKey === 'GET /admin/adoptions/{id}') {
      return await handleDetail(applicationId);
    }
    if (event.routeKey === 'PATCH /admin/adoptions/{id}') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return respond(400, { error: 'Invalid JSON body' });
      }
      return await handleUpdateStatus(applicationId, body);
    }
    return respond(404, { error: `No handler for route: ${event.routeKey}` });
  } catch (err) {
    console.error('Admin adoptions request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
