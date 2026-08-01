// s3.js
// Uploads the generated PDF to S3 and creates presigned PUT URLs for any
// fence photos, so the browser can upload large image files directly to S3
// rather than routing them through this Lambda / API Gateway's payload limits.

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('crypto');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const PDF_BUCKET = process.env.ADOPTION_PDF_BUCKET || 'sixspurranch-adoption-pdfs';
const UPLOADS_BUCKET = process.env.ADOPTION_UPLOADS_BUCKET || 'sixspurranch-adoption-uploads';

async function uploadPdf(applicationId, pdfBuffer) {
  const key = `${applicationId}/application.pdf`;
  await s3.send(
    new PutObjectCommand({
      Bucket: PDF_BUCKET,
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    })
  );
  return key;
}

/**
 * Generates a presigned PUT URL for each fence photo filename, so the
 * browser can upload directly to S3 BEFORE the application is submitted.
 * This ordering matters: the photos need to already exist in S3 by the
 * time /adopt/apply runs, so the PDF generator can fetch and embed them.
 * Returns [{ fileName, uploadUrl, key }].
 */
async function createPresignedUploadUrls(applicationId, fileNames) {
  const results = [];

  for (const fileName of fileNames) {
    const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const key = `${applicationId}/fence-photos/${randomUUID()}-${safeName}`;

    const command = new PutObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 min

    results.push({ fileName, uploadUrl, key });
  }

  return results;
}

/**
 * Fetches a previously-uploaded fence photo's raw bytes from S3, for
 * embedding into the generated PDF.
 */
async function getFencePhotoBytes(key) {
  const { Body, ContentType } = await s3.send(new GetObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key }));
  const bytes = await Body.transformToByteArray();
  return { bytes: Buffer.from(bytes), contentType: ContentType || '' };
}

/**
 * Generates a short-lived presigned GET URL so the admin inbox can offer
 * a download link without making the PDF bucket public.
 */
async function getPresignedDownloadUrl(key) {
  const command = new GetObjectCommand({ Bucket: PDF_BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 900 }); // 15 min
}

module.exports = {
  uploadPdf,
  createPresignedUploadUrls,
  getFencePhotoBytes,
  getPresignedDownloadUrl,
  PDF_BUCKET,
  UPLOADS_BUCKET,
};
