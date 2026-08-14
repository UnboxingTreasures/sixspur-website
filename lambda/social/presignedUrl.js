// presignedUrl.js — generates a presigned S3 PUT URL for social media post images
// Uploads go to the PUBLIC sixspurranch-assets bucket (under social-uploads/) since
// Instagram/Facebook's servers need to be able to fetch the resulting image URL.
//
// AUTH: this route requires a verified JWT (via the same authorizer
// protecting /donor/* and /donate/*) AND isAdmin=true on the donor
// record -- see requireAdmin() in adminAuth.js. Without this, anyone
// could get a presigned URL and upload arbitrary files into the
// organization's public asset bucket.

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require('crypto');
const { requireAdmin } = require('./adminAuth');

const s3 = new S3Client({ region: "us-east-1" });
const BUCKET = "sixspurranch-assets";

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const auth = await requireAdmin(event);
  if (!auth.authorized) {
    return {
      statusCode: auth.statusCode,
      headers,
      body: JSON.stringify({ success: false, message: auth.error }),
    };
  }

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { filename, content_type } = body || {};

    if (!filename || !content_type) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, message: 'filename and content_type are required' }),
      };
    }

    const ext = filename.split('.').pop() || 'jpg';
    const staging_key = `social-uploads/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: staging_key,
      ContentType: content_type,
    });

    const presigned_url = await getSignedUrl(s3, command, { expiresIn: 300 });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, presigned_url, staging_key }),
    };

  } catch (error) {
    console.error('presignedUrl error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, message: error.message || 'Internal server error' }),
    };
  }
};
