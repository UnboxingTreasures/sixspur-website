// s3.js
// Generates a short-lived presigned GET URL so the admin Adoptions page can
// offer a PDF download link without making the PDF bucket public.

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const PDF_BUCKET = process.env.ADOPTION_PDF_BUCKET || 'sixspurranch-adoption-pdfs';

async function getPresignedDownloadUrl(key) {
  const command = new GetObjectCommand({ Bucket: PDF_BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 900 }); // 15 min
}

module.exports = { getPresignedDownloadUrl };
