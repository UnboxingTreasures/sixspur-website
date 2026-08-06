// postToFacebook.js — Posts to Facebook Page via Meta Graph API
// Supports text-only posts or text + image URL
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const https = require('https');

const secretsClient = new SecretsManagerClient({ region: "us-east-1" });

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? new URLSearchParams(body).toString() : null;
    if (bodyStr) {
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
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

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { message, image_url } = body || {};

    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, message: 'message is required' }),
      };
    }

    // Fetch credentials from Secrets Manager
    const secretResp = await secretsClient.send(new GetSecretValueCommand({
      SecretId: 'sixspur/meta-api',
    }));
    const creds = JSON.parse(secretResp.SecretString);
    const { facebook_page_id, facebook_page_token } = creds;

    const postParams = {
      message,
      access_token: facebook_page_token,
    };

    const endpoint = image_url
      ? `/v19.0/${facebook_page_id}/photos`
      : `/v19.0/${facebook_page_id}/feed`;

    if (image_url) {
      postParams.url = image_url;
    }

    const res = await httpsRequest({
      hostname: 'graph.facebook.com',
      path: endpoint,
      method: 'POST',
    }, postParams);

    const responseData = JSON.parse(res.body);
    console.log('Facebook post response:', res.status, JSON.stringify(responseData));

    if (responseData.id) {
      const postId = responseData.id;
      console.log(`Posted to Facebook: post_id=${postId}`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Posted to Facebook successfully',
          data: {
            post_id: postId,
            post_url: `https://www.facebook.com/${facebook_page_id}/posts/${postId.split('_')[1] || postId}`,
          },
        }),
      };
    } else {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ success: false, message: 'Facebook API error', detail: responseData }),
      };
    }

  } catch (error) {
    console.error('postToFacebook error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, message: error.message || 'Internal server error' }),
    };
  }
};
