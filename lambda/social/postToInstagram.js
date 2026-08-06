// postToInstagram.js — Posts to Instagram via Meta Graph API
// Every IG post requires an image URL — text-only posts are not supported
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const https = require('https');

const secretsClient = new SecretsManagerClient({ region: "us-east-1" });

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) {
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      };
    }
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function buildQueryString(params) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { caption, image_url } = body || {};

    if (!caption || !image_url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, message: 'caption and image_url are required' }),
      };
    }

    if (caption.length > 2200) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, message: 'caption exceeds 2200 characters' }),
      };
    }

    // Fetch credentials from Secrets Manager
    const secretResp = await secretsClient.send(new GetSecretValueCommand({
      SecretId: 'sixspur/meta-api',
    }));
    const creds = JSON.parse(secretResp.SecretString);
    const { instagram_business_account_id, instagram_access_token } = creds;

    // Step 1: Create media container
    const containerParams = buildQueryString({
      image_url,
      caption,
      access_token: instagram_access_token,
    });

    const containerRes = await httpsRequest({
      hostname: 'graph.instagram.com',
      path: `/v19.0/${instagram_business_account_id}/media?${containerParams}`,
      method: 'POST',
    });

    const containerData = JSON.parse(containerRes.body);
    console.log('Container response:', containerRes.status, JSON.stringify(containerData));

    if (!containerData.id) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ success: false, message: 'Failed to create media container', detail: containerData }),
      };
    }

    const creationId = containerData.id;

    // Wait for media to finish processing before publishing
    let ready = false;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const statusParams = buildQueryString({
        fields: 'status_code',
        access_token: instagram_access_token,
      });
      const statusRes = await httpsRequest({
        hostname: 'graph.instagram.com',
        path: `/v19.0/${creationId}?${statusParams}`,
        method: 'GET',
      });
      const statusData = JSON.parse(statusRes.body);
      console.log(`Media status check ${i + 1}:`, statusData.status_code);
      if (statusData.status_code === 'FINISHED') {
        ready = true;
        break;
      } else if (statusData.status_code === 'ERROR') {
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({ success: false, message: 'Media processing failed', detail: statusData }),
        };
      }
    }

    if (!ready) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ success: false, message: 'Media processing timed out' }),
      };
    }

    // Step 2: Publish the container
    const publishParams = buildQueryString({
      creation_id: creationId,
      access_token: instagram_access_token,
    });

    const publishRes = await httpsRequest({
      hostname: 'graph.instagram.com',
      path: `/v19.0/${instagram_business_account_id}/media_publish?${publishParams}`,
      method: 'POST',
    });

    const publishData = JSON.parse(publishRes.body);
    console.log('Publish response:', publishRes.status, JSON.stringify(publishData));

    if (!publishData.id) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ success: false, message: 'Failed to publish media', detail: publishData }),
      };
    }

    const postId = publishData.id;
    console.log(`Posted to Instagram: post_id=${postId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Posted to Instagram successfully',
        data: {
          post_id: postId,
          post_url: `https://www.instagram.com/p/${postId}/`,
        },
      }),
    };

  } catch (error) {
    console.error('postToInstagram error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, message: error.message || 'Internal server error' }),
    };
  }
};
