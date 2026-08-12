// index.js
// Admin routes for viewing and managing donation records.
//   GET   /admin/donations          — list all
//   GET   /admin/donations/{id}     — one donation
//   PATCH /admin/donations/{id}     — status (e.g. mark refunded) and notes only -- no delete, see dynamo.js
//
// No manual-entry route -- considered, built, then deliberately dropped.
// All donations come through the real PayPal checkout flow (see the
// donate Lambda). Offline gifts (checks, cash) are tracked by the
// client outside this system.

const { listAll, getById, updateDonation } = require('./dynamo');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,PATCH,OPTIONS',
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

  const donationId = event.pathParameters?.id;
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
      case 'GET /admin/donations': {
        const donations = await listAll();
        return respond(200, { donations });
      }

      case 'GET /admin/donations/{id}': {
        const donation = await getById(donationId);
        if (!donation) return respond(404, { error: 'Donation not found' });
        return respond(200, donation);
      }

      case 'PATCH /admin/donations/{id}': {
        try {
          const updated = await updateDonation(donationId, body);
          if (!updated) return respond(404, { error: 'Donation not found' });
          return respond(200, updated);
        } catch (err) {
          return respond(400, { error: err.message });
        }
      }

      default:
        return respond(404, { error: `No handler for route: ${event.routeKey}` });
    }
  } catch (err) {
    console.error('Admin donations request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
