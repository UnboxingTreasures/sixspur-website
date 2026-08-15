// index.js
// Donor-facing recurring donation management, protected by the same
// Cognito JWT authorizer as the one-time donate Lambda (lambda/donate).
//
//   POST /donate/recurring/create-subscription  — starts a new monthly subscription, returns PayPal's approval link
//   POST /donate/recurring/cancel                — cancels a subscription (site-initiated half; see paypal.js)
//   GET  /donate/recurring/mine                  — donor's own subscriptions, for the account page
//
// Admin route (GET /admin/recurring-donations) intentionally NOT in
// this file yet -- it needs to match the exact JWT + isAdmin check
// pattern already used across the other admin Lambdas in this project,
// which isn't in front of me yet. See chat for what's still needed.
//
// The webhook handler is a SEPARATE Lambda (donate-recurring-webhook),
// deliberately not merged into this one -- that route sits outside the
// JWT authorizer entirely (PayPal isn't a logged-in donor), and every
// route in this file currently assumes a verified donor exists.

const { createSubscription, cancelSubscription } = require('./paypal');
const { createSubscriptionRecord, getSubscriptionsByDonor, getSubscriptionById } = require('./dynamo');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
};

const ALLOWED_TIERS = [10, 25, 50, 100];

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function getVerifiedDonor(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims?.sub) return null;
  return { donorId: claims.sub, email: claims.email };
}

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, {});
  }

  const donor = getVerifiedDonor(event);
  if (!donor) {
    return respond(401, { error: 'Not authenticated' });
  }

  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return respond(400, { error: 'Invalid JSON body' });
    }
  }

  try {
    switch (event.routeKey) {
      case 'POST /donate/recurring/create-subscription': {
        const tier = Number(body.tier);
        if (!ALLOWED_TIERS.includes(tier)) {
          return respond(400, { error: `tier must be one of: ${ALLOWED_TIERS.join(', ')}` });
        }

        const siteUrl = process.env.SITE_URL || 'https://sixspurranch.org';
        const paypalSub = await createSubscription({
          tier,
          donorId: donor.donorId,
          donorEmail: donor.email,
          returnUrl: `${siteUrl}/account?recurring=confirmed`,
          cancelUrl: `${siteUrl}/donate?recurring=cancelled`,
        });

        await createSubscriptionRecord({
          subscriptionId: paypalSub.id,
          donorId: donor.donorId,
          donorEmail: donor.email,
          tier,
        });

        const approveLink = paypalSub.links?.find((l) => l.rel === 'approve')?.href;
        if (!approveLink) {
          console.error('No approve link in PayPal response:', JSON.stringify(paypalSub));
          return respond(502, { error: 'Could not start subscription approval. Please try again.' });
        }

        return respond(200, { subscriptionId: paypalSub.id, approveUrl: approveLink });
      }

      case 'POST /donate/recurring/cancel': {
        const subscriptionId = body.subscriptionId;
        if (!subscriptionId) return respond(400, { error: 'subscriptionId is required' });

        const record = await getSubscriptionById(subscriptionId);
        if (!record || record.donorId !== donor.donorId) {
          return respond(404, { error: 'Subscription not found' });
        }
        if (record.status === 'cancelled') {
          return respond(200, record); // already cancelled, nothing to do
        }

        await cancelSubscription(subscriptionId);
        // Deliberately NOT updating status here -- the
        // BILLING.SUBSCRIPTION.CANCELLED webhook is the single source of
        // truth, so a site-initiated cancel and a donor cancelling
        // directly on paypal.com both converge on the same update path.
        return respond(200, { ...record, status: 'cancelling' });
      }

      case 'GET /donate/recurring/mine': {
        const subscriptions = await getSubscriptionsByDonor(donor.donorId);
        return respond(200, { subscriptions });
      }

      default:
        return respond(404, { error: `No handler for route: ${event.routeKey}` });
    }
  } catch (err) {
    console.error('Recurring donation request failed:', err);
    return respond(500, { error: 'Something went wrong. Please try again or contact us.' });
  }
};
