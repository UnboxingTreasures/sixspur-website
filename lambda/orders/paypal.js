// paypal.js
// Same PayPal Orders v2 pattern as lambda/donate/paypal.js -- same
// secret (sixspur/paypal-api), same sandbox/live switch via
// PAYPAL_MODE, same intent=CAPTURE (shop orders are simple physical
// merch, no reason to hold funds separately from capture).
//
// Not shared as a common module with donate/paypal.js on purpose --
// same reasoning as FundraiserThermometer.tsx not sharing code with the
// general donate flow: keeps this Lambda's payment logic independent
// so a future donate-side change can't accidentally break checkout.

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
 * Creates a PayPal order for the cart total. This is a quote, not a
 * charge -- no money moves until captureOrder() below is called after
 * the buyer approves AND our own stock reservation transaction has
 * already succeeded. Called BEFORE the reservation on purpose (see
 * dynamo.js) -- creating an order here that never gets captured is
 * harmless and needs no cleanup.
 */
async function createOrder(total, currency = 'USD') {
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
          description: 'Six Spur Ranch and Rescue Shop Order',
          amount: { currency_code: currency, value: total.toFixed(2) },
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal create order failed: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Captures a buyer-approved order. Only ever called AFTER our stock
 * reservation transaction has already succeeded -- so by the time this
 * runs, the items are guaranteed to be held. This is the authoritative
 * confirmation of payment, called synchronously, same as donate.
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
