// paypal.js
// PayPal refund calls for donations. Same OAuth/credentials pattern as
// every other paypal.js in this project (lambda/donate,
// lambda/orders, etc.) -- same secret (sixspur/paypal-api), same
// sandbox/live switch via PAYPAL_MODE. Not shared as a common module,
// same reasoning as the others: keeps this Lambda's payment logic
// independent so a change elsewhere can't accidentally affect refunds.
//
// This is the FIRST time adminDonations has ever called PayPal --
// previously "Mark as Refunded" only updated the database record, with
// no actual money movement. Real refund automation, built as the
// explicit gate before PayPal can flip from sandbox to live credentials.

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const PAYPAL_API_BASE = PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const SECRET_NAME = process.env.PAYPAL_SECRET_NAME || 'sixspur/paypal-api';

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
 * Refunds a captured payment, full or partial. captureId is the
 * paypalTransactionId already stored on the donation record from when
 * it was originally captured (see lambda/donate/dynamo.js).
 *
 * IDEMPOTENCY: PayPal's PayPal-Request-Id header makes a refund request
 * safe to retry -- if the same key is sent twice, PayPal returns the
 * ORIGINAL refund result instead of processing a second one. The caller
 * (dynamo.js's buildRefundIdempotencyKey) derives this from the
 * donation's amount already refunded *before* this attempt, so retrying
 * the SAME attempt (e.g. our own DynamoDB write failed after PayPal
 * already succeeded, admin clicks Refund again) reuses the same key and
 * lands on the already-completed refund -- while a genuinely NEW,
 * separate partial refund later gets a different key, since the
 * "already refunded" baseline it's derived from will have changed by
 * then.
 *
 * amount/currency omitted entirely (not just falsy) means a full refund
 * of whatever remains capturable on that transaction, per PayPal's own
 * API behavior -- so partial-refund callers must always pass both.
 */
async function refundCapture(captureId, { amount, currency, idempotencyKey } = {}) {
  const token = await getAccessToken();

  const body = {};
  if (amount !== undefined && amount !== null) {
    body.amount = { value: amount.toFixed(2), currency_code: currency || 'USD' };
  }

  const res = await fetch(`${PAYPAL_API_BASE}/v2/payments/captures/${captureId}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'PayPal-Request-Id': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Surface PayPal's own error detail where available (e.g. "already
    // fully refunded", "capture too old to refund", "insufficient
    // funds in the connected PayPal balance") rather than a generic
    // failure -- this is what actually shows up in the admin UI.
    const detail = data?.details?.[0]?.description || data?.message || JSON.stringify(data);
    const err = new Error(`PayPal refund failed: ${detail}`);
    err.paypalStatus = data?.status;
    err.paypalRawResponse = data;
    throw err;
  }

  return data; // includes id (the refund's own PayPal ID), status, amount
}

module.exports = { refundCapture };
