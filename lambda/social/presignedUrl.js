// presignedUrl.js — generates a presigned S3 PUT URL for social media post images
// Uploads go to the PUBLIC sixspurranch-assets bucket (under social-uploads/) since
// Instagram/Facebook's servers need to be able to fetch the resulting image URL.
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require('crypto');

const s3 = new S3Client({ region: "us-east-1" });
const BUCKET = "sixspurranch-assets";

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

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
