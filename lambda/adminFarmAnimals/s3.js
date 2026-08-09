// s3.js
// Photo storage lives in the same sixspurranch-assets bucket + CloudFront
// distribution as the rest of the site's images, under images/{animalId}/.

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('crypto');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const BUCKET = process.env.ASSETS_BUCKET || 'sixspurranch-assets';
const CDN_BASE = process.env.CDN_BASE || 'https://d1s8s7aw8vf5zu.cloudfront.net';

function cdnUrlToKey(url) {
  if (!url.startsWith(CDN_BASE)) {
    throw new Error(`URL is not a recognized CDN URL: ${url}`);
  }
  return url.slice(CDN_BASE.length + 1); // +1 strips the leading slash
}

/**
 * Generates a presigned PUT URL for a new photo, so the browser can upload
 * directly to S3. Returns both the upload URL (for the PUT) and the final
 * CDN URL (to store in DynamoDB once the upload completes).
 */
async function createPresignedUploadUrl(animalId, fileName) {
  const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const key = `images/${animalId}/${randomUUID()}-${safeName}`;

  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 min

  return { uploadUrl, cdnUrl: `${CDN_BASE}/${key}` };
}

/**
 * Deletes a photo from S3 given its CDN URL. Callers are responsible for
 * confirming beforehand that the URL isn't still in use by another animal
 * type -- this function does not re-check, it just deletes.
 */
async function deletePhoto(cdnUrl) {
  const key = cdnUrlToKey(cdnUrl);
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = { createPresignedUploadUrl, deletePhoto, cdnUrlToKey };
