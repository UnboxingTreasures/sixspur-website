// recreate-paypal-plans.js
// Full re-creation of the Product + 3 preset Plans ($5/$10/$20) under
// the CORRECT PayPal sandbox app -- the previous Product/Plans
// (create-paypal-plans.js, then create-additional-paypal-plans.js)
// were created against credentials that turned out not to match any
// app visible in the dashboard, so the webhook (registered on the one
// real, visible app) was never receiving events for subscriptions
// created against those old Plans. This script starts clean: new
// Product, new Plans, all under whatever credentials are currently in
// sixspur/paypal-api (update that secret FIRST, then run this).
//
// Run with:  AWS_PROFILE=sixspur node recreate-paypal-plans.js

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { LambdaClient, UpdateFunctionConfigurationCommand, GetFunctionConfigurationCommand } = require('@aws-sdk/client-lambda');

const REGION = 'us-east-1';
const FUNCTION_NAME = 'sixspur-donate-recurring';
const SECRET_NAME = 'sixspur/paypal-api';
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
const PAYPAL_API_BASE = PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

const secretsClient = new SecretsManagerClient({ region: REGION });
const lambdaClient = new LambdaClient({ region: REGION });

const TIERS = [5, 10, 20];

async function getCredentials() {
  const result = await secretsClient.send(new GetSecretValueCommand({ SecretId: SECRET_NAME }));
  return JSON.parse(result.SecretString);
}

async function getAccessToken(clientId, clientSecret) {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function createProduct(token) {
  const res = await fetch(`${PAYPAL_API_BASE}/v1/catalogs/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Six Spur Ranch Monthly Donation',
      description: 'Recurring monthly donation to Six Spur Ranch and Rescue',
      type: 'SERVICE',
      category: 'NONPROFIT',
    }),
  });
  if (!res.ok) throw new Error(`PayPal create product failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

async function createPlan(token, productId, tier) {
  const res = await fetch(`${PAYPAL_API_BASE}/v1/billing/plans`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: productId,
      name: `Six Spur Monthly Donation - $${tier}`,
      description: `$${tier}/month recurring donation`,
      billing_cycles: [
        {
          frequency: { interval_unit: 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: { fixed_price: { value: tier.toFixed(2), currency_code: 'USD' } },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 3,
      },
    }),
  });
  if (!res.ok) throw new Error(`PayPal create plan failed for $${tier}: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

async function updateLambdaEnv(planIds) {
  const current = await lambdaClient.send(new GetFunctionConfigurationCommand({ FunctionName: FUNCTION_NAME }));
  const existingVars = current.Environment?.Variables || {};

  const updatedVars = {
    ...existingVars,
    PLAN_ID_5: planIds[5],
    PLAN_ID_10: planIds[10],
    PLAN_ID_20: planIds[20],
  };

  await lambdaClient.send(new UpdateFunctionConfigurationCommand({
    FunctionName: FUNCTION_NAME,
    Environment: { Variables: updatedVars },
  }));
}

async function main() {
  console.log(`Mode: ${PAYPAL_MODE}`);
  console.log('Fetching PayPal credentials from Secrets Manager (should now be the corrected app)...');
  const { clientId, clientSecret } = await getCredentials();
  console.log(`  Using Client ID: ${clientId.slice(0, 12)}...`);

  console.log('Getting PayPal access token...');
  const token = await getAccessToken(clientId, clientSecret);

  console.log('Creating PayPal Product...');
  const productId = await createProduct(token);
  console.log(`  Product ID: ${productId}`);

  const planIds = {};
  for (const tier of TIERS) {
    console.log(`Creating Plan for $${tier}/month...`);
    planIds[tier] = await createPlan(token, productId, tier);
    console.log(`  Plan ID: ${planIds[tier]}`);
  }

  console.log('Updating sixspur-donate-recurring Lambda environment variables...');
  await updateLambdaEnv(planIds);

  console.log('');
  console.log('Done. New Plan IDs (already saved to Lambda env vars):');
  for (const tier of TIERS) {
    console.log(`  $${tier}/mo -> ${planIds[tier]}`);
  }
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
