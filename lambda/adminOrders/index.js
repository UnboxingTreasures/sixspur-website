// index.js
// Admin routes for viewing and managing shop order records.
//   GET   /admin/orders          — list all (excludes pending/expired -- see dynamo.js)
//   GET   /admin/orders/{id}     — one order
//   PATCH /admin/orders/{id}     — status (paid -> shipped or -> refunded), trackingNumber, notes only -- no delete, see dynamo.js
//
// AUTH: every route here requires a verified JWT (via the same
// authorizer protecting /donor/*, /donate/*, and every other admin
// Lambda) AND isAdmin=true on the donor record -- see requireAdmin() in
// adminAuth.js. Same pattern as every other admin Lambda in this
// project, not a new auth approach.

const { listAll, getById, updateOrder } = require('./dynamo');
const { requireAdmin } = require('./adminAuth');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
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

  const auth = await requireAdmin(event);
  if (!auth.authorized) {
    return respond(auth.statusCode, { error: auth.error });
  }

  const orderId = event.pathParameters?.id;
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
      case 'GET /admin/orders': {
        const orders = await listAll();
        return respond(200, { orders });
      }

      case 'GET /admin/orders/{id}': {
        const order = await getById(orderId);
        if (!order) return respond(404, { error: 'Order not found' });
        return respond(200, order);
      }

      case 'PATCH /admin/orders/{id}': {
        try {
          const updated = await updateOrder(orderId, body);
          if (!updated) return respond(404, { error: 'Order not found' });
          return respond(200, updated);
        } catch (err) {
          return respond(400, { error: err.message });
        }
      }

      default:
        return respond(404, { error: `No handler for route: ${event.routeKey}` });
    }
  } catch (err) {
    console.error('Admin orders request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
