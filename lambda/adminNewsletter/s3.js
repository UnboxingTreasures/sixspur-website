// s3.js
// Presigned upload for the optional image on a newsletter blast. Same
// pattern as news/s3.js and social/presignedUrl.js -- uploads go to the
// PUBLIC sixspurranch-assets bucket, since email clients need to be able
// to fetch the resulting image URL directly (no auth on that request).
// No "slug" concept here (unlike news) since a blast isn't a persistent,
// individually-addressable piece of content -- just a timestamped key.

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.ASSETS_BUCKET || 'sixspurranch-assets';
const CDN_BASE = process.env.CDN_BASE_URL || 'https://d1s8s7aw8vf5zu.cloudfront.net';

async function createPresignedUploadUrl(fileName) {
  const ext = (fileName || '').split('.').pop() || 'jpg';
  const key = `newsletter-uploads/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  const cdnUrl = `${CDN_BASE}/${key}`;

  return { uploadUrl, cdnUrl };
}

// Best-effort cleanup if an admin uploads an image, then changes their
// mind before sending -- never blocks the actual send flow if it fails.
async function deletePhotoSafely(cdnUrl) {
  if (!cdnUrl) return;
  try {
    const key = cdnUrl.split(`${CDN_BASE}/`)[1];
    if (!key) return;
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error('Failed to delete newsletter image from S3:', err);
  }
}

module.exports = { createPresignedUploadUrl, deletePhotoSafely };
