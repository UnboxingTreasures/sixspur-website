// paypal.js
// PayPal API helper for the webhook Lambda -- just enough to verify
// webhook signatures. Credentials pattern matches lambda/donate/paypal.js
// (Secrets Manager, sixspur/paypal-api) exactly; duplicated here rather
// than shared since this project doesn't use a Lambda layer, same as
// the existing donate/paypal.js + orders/paypal.js duplication.

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const PAYPAL_API_BASE = PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const SECRET_NAME = process.env.PAYPAL_SECRET_NAME || 'sixspur/paypal-api';
const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID; // from the PayPal dashboard, set once the webhook is registered

let cachedCredentials = null;

async function getCredentials() {
  if (cachedCredentials) return cachedCredentials;
  const result = await secretsClient.send(new GetSecretValueCommand({ SecretId: SECRET_NAME }));
  cachedCredentials = JSON.parse(result.SecretString);
  return cachedCredentials;
}

async function getAccessToken() {
  const { clientId, clientSecret } = await getCredentials();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Calls PayPal's own signature verification endpoint rather than
 * reimplementing the crypto locally -- PayPal recommends this approach,
 * and it's the difference between "trusting whatever hits this public
 * URL" and "trusting only requests PayPal can prove it sent."
 */
async function verifyWebhookSignature({ transmissionId, transmissionTime, certUrl, authAlgo, transmissionSig, webhookEvent }) {
  if (!WEBHOOK_ID) {
    console.error('PAYPAL_WEBHOOK_ID is not set -- cannot verify webhook signatures');
    return false;
  }

  const token = await getAccessToken();

  const res = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: WEBHOOK_ID,
      webhook_event: webhookEvent,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Webhook verification call failed: ${res.status} ${text}`);
    return false;
  }

  const data = await res.json();
  return data.verification_status === 'SUCCESS';
}

module.exports = { getAccessToken, verifyWebhookSignature };
