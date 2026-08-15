// paypal.js
// Wrapper around PayPal's Subscriptions/Billing Plans REST API, for
// recurring monthly donations. Mirrors the OAuth/credentials pattern
// from lambda/donate/paypal.js (Secrets Manager, sixspur/paypal-api) --
// same credentials work for both Orders v2 and Subscriptions, this is
// still just PayPal API auth, not a separate app.
//
// Plan IDs are NOT secret -- they're just PayPal resource identifiers
// for the pre-created preset tiers ($10/$25/$50/$100), so they live in
// Lambda env vars (PLAN_ID_10 etc.) rather than Secrets Manager. Create
// these once (via PayPal's dashboard or a one-off script) before this
// Lambda can create any subscriptions.

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const PAYPAL_API_BASE = PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const SECRET_NAME = process.env.PAYPAL_SECRET_NAME || 'sixspur/paypal-api';

const TIER_PLAN_IDS = {
  10: process.env.PLAN_ID_10,
  25: process.env.PLAN_ID_25,
  50: process.env.PLAN_ID_50,
  100: process.env.PLAN_ID_100,
};

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

function planIdForTier(tier) {
  const planId = TIER_PLAN_IDS[tier];
  if (!planId) throw new Error(`No PayPal plan configured for tier: ${tier}`);
  return planId;
}

/**
 * Creates a subscription for a preset tier. Unlike a one-time order,
 * this does NOT complete synchronously -- PayPal returns an "approve"
 * link the donor must be redirected to, approve on PayPal's site, then
 * get redirected back to return_url. The subscription only becomes
 * ACTIVE after that approval, confirmed to us via the
 * BILLING.SUBSCRIPTION.ACTIVATED webhook, not this response.
 */
async function createSubscription({ tier, donorId, donorEmail, returnUrl, cancelUrl }) {
  const token = await getAccessToken();
  const planId = planIdForTier(tier);

  const res = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plan_id: planId,
      custom_id: donorId, // threaded back to us on every webhook event for this subscription
      subscriber: { email_address: donorEmail },
      application_context: {
        brand_name: 'Six Spur Ranch and Rescue',
        user_action: 'SUBSCRIBE_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal create subscription failed: ${res.status} ${text}`);
  }

  return res.json(); // includes .id and .links (find rel: "approve")
}

/**
 * Cancels a subscription. This is the site-initiated half of
 * cancellation -- it does NOT flip our own DB status. We wait for the
 * BILLING.SUBSCRIPTION.CANCELLED webhook to do that, the same webhook
 * that fires if the donor instead cancels directly from their PayPal
 * account. That convergence is the whole point: one code path updates
 * the DB regardless of which side the cancellation came from.
 */
async function cancelSubscription(subscriptionId, reason = 'Cancelled by donor request') {
  const token = await getAccessToken();

  const res = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });

  // PayPal returns 204 No Content on success -- nothing to parse.
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`PayPal cancel subscription failed: ${res.status} ${text}`);
  }
}

async function getSubscription(subscriptionId) {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal get subscription failed: ${res.status} ${text}`);
  }
  return res.json();
}

module.exports = { getAccessToken, createSubscription, cancelSubscription, getSubscription, TIER_PLAN_IDS };
