// paypal.js
// Thin wrapper around PayPal's Orders v2 REST API for one-time
// donations. Recurring/subscription donations are NOT handled here --
// that's a separate, more involved piece (different API entirely, the
// Subscriptions/Billing Plans API) intentionally left as a design
// writeup for review rather than built blind, see the project notes.
//
// Credentials come from Secrets Manager (sixspur/paypal-api), same
// pattern already used for the Meta/Facebook API secret
// (sixspur/meta-api) elsewhere in this project -- not a new pattern.

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox'; // 'sandbox' or 'live'
const PAYPAL_API_BASE = PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const SECRET_NAME = process.env.PAYPAL_SECRET_NAME || 'sixspur/paypal-api';

let cachedCredentials = null;

async function getCredentials() {
  if (cachedCredentials) return cachedCredentials;
  const result = await secretsClient.send(new GetSecretValueCommand({ SecretId: SECRET_NAME }));
  cachedCredentials = JSON.parse(result.SecretString);
  return cachedCredentials;
}

/**
 * Gets an OAuth2 access token via client credentials grant. PayPal
 * tokens are short-lived (a few hours) -- not caching this across
 * invocations for now since Lambda cold starts make that unreliable
 * anyway; each request just gets a fresh token. Fine for this volume.
 */
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
 * Creates a PayPal order for a one-time donation. intent=CAPTURE means
 * the payment is captured immediately once the donor approves -- no
 * separate authorize-then-capture step, appropriate for a donation
 * (nothing to ship, no reason to hold funds).
 */
async function createOrder(amount, currency = 'USD') {
  const token = await getAccessToken();

  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          description: 'Donation to Six Spur Ranch and Rescue',
          amount: { currency_code: currency, value: amount.toFixed(2) },
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal create order failed: ${res.status} ${text}`);
  }

  return res.json(); // includes .id (the PayPal order ID) and approval links
}

/**
 * Captures a previously-created and donor-approved order. This is the
 * AUTHORITATIVE confirmation of payment -- called synchronously from our
 * own backend right after the donor approves, not relying on a webhook
 * to eventually tell us. See paypal-recurring-design.md for why webhooks
 * matter more for recurring charges specifically, where there's no
 * equivalent synchronous moment to hook into.
 */
async function captureOrder(paypalOrderId) {
  const token = await getAccessToken();

  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal capture failed: ${res.status} ${text}`);
  }

  return res.json();
}

module.exports = { createOrder, captureOrder };
