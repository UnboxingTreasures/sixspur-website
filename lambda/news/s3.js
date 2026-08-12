// s3.js
// Photo storage for news posts, in the same sixspurranch-assets bucket +
// CloudFront distribution as everything else, under images/news/.

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('crypto');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const BUCKET = process.env.ASSETS_BUCKET || 'sixspurranch-assets';
const CDN_BASE = process.env.CDN_BASE || 'https://d1s8s7aw8vf5zu.cloudfront.net';

function cdnUrlToKey(url) {
  if (!url.startsWith(CDN_BASE)) return null; // old posts may have a local /images/... path, not a CDN URL -- not ours to delete
  return url.slice(CDN_BASE.length + 1);
}

async function createPresignedUploadUrl(slugHint, fileName) {
  const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const safeSlugHint = (slugHint || 'post').replace(/[^a-z0-9-]/g, '');
  const key = `images/news/${safeSlugHint}-${randomUUID()}-${safeName}`;

  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

  return { uploadUrl, cdnUrl: `${CDN_BASE}/${key}` };
}

/**
 * Best-effort delete -- never throws. Called when a post's image is
 * replaced or the post itself is deleted; failing to clean up an old
 * photo shouldn't block the actual save/delete operation the person is
 * waiting on.
 */
async function deletePhotoSafely(cdnUrl) {
  if (!cdnUrl) return;
  const key = cdnUrlToKey(cdnUrl);
  if (!key) return; // not a CDN URL we manage (e.g. an old local path), leave it alone
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error(`Failed to delete old news photo (${cdnUrl}):`, err);
  }
}

module.exports = { createPresignedUploadUrl, deletePhotoSafely };
