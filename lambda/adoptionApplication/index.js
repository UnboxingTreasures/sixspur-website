// index.js
// Two routes:
//   POST /adopt/photos/presign  — generates an applicationId + presigned
//                                  upload URLs for fence photos, BEFORE
//                                  the application itself is submitted
//   POST /adopt/apply           — generates the PDF (embedding any fence
//                                  photos already uploaded via the presign
//                                  step above), saves to adoption_applications
//                                  with status "Open", notifies admin
//
// Ordering matters here: photos must exist in S3 before /adopt/apply runs,
// or there's nothing for the PDF generator to fetch and embed.

const { randomUUID } = require('crypto');
const { generateApplicationPdf } = require('./pdf');
const { uploadPdf, createPresignedUploadUrls, getFencePhotoBytes } = require('./s3');
const { saveApplication } = require('./dynamo');
const { notifyAdmin } = require('./notify');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handlePresign(body) {
  const fileNames = Array.isArray(body.fileNames) ? body.fileNames : [];
  if (fileNames.length === 0) {
    return respond(400, { error: 'fileNames must be a non-empty array' });
  }

  const applicationId = randomUUID();
  const uploads = await createPresignedUploadUrls(applicationId, fileNames);

  return respond(200, {
    applicationId,
    uploads: uploads.map((u) => ({ fileName: u.fileName, uploadUrl: u.uploadUrl, key: u.key })),
  });
}

async function handleApply(body) {
  if (!body.firstName || !body.lastName || !body.primaryEmail || !body.interestedIn) {
    return respond(400, { error: 'Missing required fields' });
  }
  if (!EMAIL_REGEX.test(body.primaryEmail)) {
    return respond(400, { error: 'A valid email address is required' });
  }
  if (!body.agreedToTerms || !body.agreedToReturn) {
    return respond(400, { error: 'You must agree to the terms and return policy' });
  }

  const applicationId = body.applicationId || randomUUID();
  const fencePhotoKeys = Array.isArray(body.fencePhotoKeys) ? body.fencePhotoKeys : [];

  // Fetch each already-uploaded fence photo's bytes so the PDF generator
  // can embed real thumbnails, not just a text mention.
  const fencePhotos = [];
  for (const key of fencePhotoKeys) {
    try {
      const { bytes, contentType } = await getFencePhotoBytes(key);
      fencePhotos.push({ key, bytes, contentType });
    } catch (err) {
      console.error(`Could not fetch fence photo ${key} for embedding:`, err);
      // Continue without this photo rather than failing the whole application
    }
  }

  const pdfBuffer = await generateApplicationPdf(body, fencePhotos);
  const pdfKey = await uploadPdf(applicationId, pdfBuffer);

  await saveApplication({
    applicationId,
    firstName: body.firstName,
    lastName: body.lastName,
    primaryEmail: body.primaryEmail,
    primaryPhone: body.primaryPhone,
    secondaryEmail: body.secondaryEmail,
    secondaryPhone: body.secondaryPhone,
    interestedIn: body.interestedIn,
    pdfKey,
    fencePhotoKeys,
  });

  await notifyAdmin({
    firstName: body.firstName,
    lastName: body.lastName,
    interestedIn: body.interestedIn,
    applicationId,
  });

  return respond(200, { success: true, applicationId });
}

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, {});
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  try {
    if (event.routeKey === 'POST /adopt/photos/presign') {
      return await handlePresign(body);
    }
    if (event.routeKey === 'POST /adopt/apply') {
      return await handleApply(body);
    }
    return respond(404, { error: `No handler for route: ${event.routeKey}` });
  } catch (err) {
    console.error('Adoption application submission failed:', err);
    return respond(500, { error: 'Something went wrong. Please try again or email us directly.' });
  }
};
