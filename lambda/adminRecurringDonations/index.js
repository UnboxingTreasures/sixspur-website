// index.js
// Admin routes for viewing recurring donation subscriptions.
//   GET /admin/recurring-donations       — list all
//   GET /admin/recurring-donations/{id}  — one subscription
//
// No PATCH route -- deliberately, mirroring adminDonations' reasoning
// for dropping manual entry. Status here is owned entirely by the
// PayPal webhook (see donate-recurring-webhook), not admin edits.
//
// AUTH: same pattern as adminDonations -- JWT authorizer + isAdmin=true
// on the donor record, checked via requireAdmin() in adminAuth.js.

const { listAll, getById } = require('./dynamo');
const { requireAdmin } = require('./adminAuth');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, {});
  }

  const auth = await requireAdmin(event);
  if (!auth.authorized) {
    return respond(auth.statusCode, { error: auth.error });
  }

  const subscriptionId = event.pathParameters?.id;

  try {
    switch (event.routeKey) {
      case 'GET /admin/recurring-donations': {
        const subscriptions = await listAll();
        return respond(200, { subscriptions });
      }

      case 'GET /admin/recurring-donations/{id}': {
        const subscription = await getById(subscriptionId);
        if (!subscription) return respond(404, { error: 'Subscription not found' });
        return respond(200, subscription);
      }

      default:
        return respond(404, { error: `No handler for route: ${event.routeKey}` });
    }
  } catch (err) {
    console.error('Admin recurring donations request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
