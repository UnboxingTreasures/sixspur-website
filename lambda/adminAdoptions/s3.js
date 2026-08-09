// s3.js
// Generates short-lived presigned GET URLs so the admin Adoptions page can
// offer a PDF download link and inline fence/enclosure photo thumbnails
// without making either bucket public.

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const PDF_BUCKET = process.env.ADOPTION_PDF_BUCKET || 'sixspurranch-adoption-pdfs';
const UPLOADS_BUCKET = process.env.ADOPTION_UPLOADS_BUCKET || 'sixspurranch-adoption-uploads';

async function getPresignedDownloadUrl(key) {
  const command = new GetObjectCommand({ Bucket: PDF_BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 900 }); // 15 min
}

async function getPresignedFencePhotoUrls(keys) {
  if (!keys || keys.length === 0) return [];
  return Promise.all(
    keys.map(async (key) => {
      const command = new GetObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key });
      const url = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 min
      return { key, url };
    })
  );
}

module.exports = { getPresignedDownloadUrl, getPresignedFencePhotoUrls };

