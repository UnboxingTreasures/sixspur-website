// postToInstagram.js — Posts to Instagram via the Facebook Graph API, using the
// long-lived Facebook Page token (same one used for postToFacebook.js), NOT a
// separate Instagram-issued token. This matches the proven-reliable architecture
// used elsewhere, rather than the separate "Instagram Login" (IGAA token) system.
// Every IG post requires an image URL — text-only posts are not supported.
//
// AUTH: this route requires a verified JWT (via the same authorizer
// protecting /donor/* and /donate/*) AND isAdmin=true on the donor
// record -- see requireAdmin() in adminAuth.js. This is admin-only:
// posting to the organization's Instagram account must never be
// reachable without that check.

const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const https = require('https');
const { requireAdmin } = require('./adminAuth');

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

// Translates known Instagram Graph API error codes into clear, actionable
// messages for the person posting, instead of a generic "failed" message.
function friendlyErrorMessage(detail) {
  const err = detail?.error;
  if (!err) return null;

  // Aspect ratio out of Instagram's supported range (4:5 portrait to 1.91:1 landscape)
  if (err.error_subcode === 2207009 || err.code === 36003) {
    return "This image's aspect ratio isn't supported by Instagram. Instagram only accepts ratios between 4:5 (portrait) and 1.91:1 (landscape) — try a different image or crop this one to fit, then try again.";
  }

  // File format/type not supported
  if (err.error_subcode === 2207008) {
    return "This image format isn't supported by Instagram. Try a standard JPEG or PNG file instead.";
  }

  // Image too large
  if (err.error_subcode === 2207026) {
    return "This image is too large for Instagram. Try a smaller file (under 8MB) and try again.";
  }

  // Fallback to Instagram's own user-facing message if it provided one
  if (err.error_user_msg) {
    return err.error_user_msg;
  }

  return null;
}

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

    // Fetch credentials from Secrets Manager — reuses the same facebook_page_token
    // and instagram_business_account_id used elsewhere, no separate IG token needed.
    const secretResp = await secretsClient.send(new GetSecretValueCommand({
      SecretId: 'sixspur/meta-api',
    }));
    const creds = JSON.parse(secretResp.SecretString);
    const { instagram_business_account_id, facebook_page_token } = creds;

    // Step 1: Create media container (via graph.facebook.com, using the Facebook token)
    const containerParams = buildQueryString({
      image_url,
      caption,
      access_token: facebook_page_token,
    });

    const containerRes = await httpsRequest({
      hostname: 'graph.facebook.com',
      path: `/v19.0/${instagram_business_account_id}/media?${containerParams}`,
      method: 'POST',
    });

    const containerData = JSON.parse(containerRes.body);
    console.log('Container response:', containerRes.status, JSON.stringify(containerData));

    if (!containerData.id) {
      const friendly = friendlyErrorMessage(containerData);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          success: false,
          message: friendly || 'Failed to create media container',
          detail: containerData,
        }),
      };
    }

    const creationId = containerData.id;

    // Wait for media to finish processing before publishing — Instagram needs time
    // to actually download and process the image regardless of token type. Poll up
    // to 10 times with 3 second intervals.
    let ready = false;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const statusParams = buildQueryString({
        fields: 'status_code',
        access_token: facebook_page_token,
      });
      const statusRes = await httpsRequest({
        hostname: 'graph.facebook.com',
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
          body: JSON.stringify({ success: false, message: 'Media processing failed — try a different image.', detail: statusData }),
        };
      }
    }

    if (!ready) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ success: false, message: 'Media processing timed out — try a different image or try again in a moment.' }),
      };
    }

    // Step 2: Publish the container
    const publishParams = buildQueryString({
      creation_id: creationId,
      access_token: facebook_page_token,
    });

    const publishRes = await httpsRequest({
      hostname: 'graph.facebook.com',
      path: `/v19.0/${instagram_business_account_id}/media_publish?${publishParams}`,
      method: 'POST',
    });

    const publishData = JSON.parse(publishRes.body);
    console.log('Publish response:', publishRes.status, JSON.stringify(publishData));

    if (!publishData.id) {
      const friendly = friendlyErrorMessage(publishData);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          success: false,
          message: friendly || 'Failed to publish media',
          detail: publishData,
        }),
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
