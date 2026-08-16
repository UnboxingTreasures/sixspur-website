// index.js
// Admin routes for viewing and managing shop order records.
//   GET   /admin/orders             — list all (excludes pending/expired -- see dynamo.js)
//   GET   /admin/orders/{id}        — one order
//   PATCH /admin/orders/{id}        — status (paid -> shipped), trackingNumber, notes only -- NOT for refunds, see below
//   POST  /admin/orders/{id}/refund — real PayPal refund, full or partial
//
// AUTH: every route here requires a verified JWT (via the same
// authorizer protecting /donor/*, /donate/*, and every other admin
// Lambda) AND isAdmin=true on the donor record -- see requireAdmin() in
// adminAuth.js. Same pattern as every other admin Lambda in this
// project, not a new auth approach.
//
// Sends a shipment notification email when status moves to 'shipped',
// mirroring how lambda/orders sends an order-confirmation email on
// capture. Wrapped in its own try/catch: a failed email must never undo
// or fail the shipment update itself, since the order really is shipped
// regardless of whether the notification went out.
//
// UPDATED -- real refund automation, same approach and reasoning as
// adminDonations/index.js: PATCH no longer accepts a refunded/
// partially_refunded status directly (that was pure record-keeping with
// no money actually moving); POST .../refund calls PayPal FIRST and
// only updates DynamoDB after PayPal confirms success, using an
// idempotency key so a retried request can't double-refund.

const { listAll, getById, updateOrder, recordRefund, buildRefundIdempotencyKey } = require('./dynamo');
const { requireAdmin } = require('./adminAuth');
const { sendShipmentNotification } = require('./email');
const { refundCapture } = require('./paypal');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
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
        // Refund status values must go through POST .../refund instead
        // -- see the module comment above for why. Allowing them here
        // would let someone mark an order "refunded" with zero money
        // having moved.
        if (body.status === 'refunded' || body.status === 'partially_refunded') {
          return respond(400, {
            error: 'Use POST /admin/orders/{id}/refund to process a real refund -- this endpoint no longer accepts a refunded status directly.',
          });
        }
        try {
          const updated = await updateOrder(orderId, body);
          if (!updated) return respond(404, { error: 'Order not found' });

          if (body.status === 'shipped') {
            try {
              await sendShipmentNotification(updated);
            } catch (emailErr) {
              console.error(`Order ${orderId} marked shipped but notification email failed:`, emailErr);
            }
          }

          return respond(200, updated);
        } catch (err) {
          return respond(400, { error: err.message });
        }
      }

      case 'POST /admin/orders/{id}/refund': {
        const order = await getById(orderId);
        if (!order) return respond(404, { error: 'Order not found' });

        if (!order.paypalTransactionId) {
          return respond(400, { error: 'This order has no PayPal transaction on record and cannot be refunded automatically.' });
        }

        const alreadyRefunded = order.refundedAmount || 0;
        const remaining = Math.round((order.total - alreadyRefunded) * 100) / 100;

        if (remaining <= 0) {
          return respond(400, { error: 'This order has already been fully refunded.' });
        }

        // Default to a full refund of whatever remains -- an admin only
        // needs to specify `amount` for a deliberate partial refund
        // (e.g. refunding one out-of-stock item from a multi-item order).
        const requestedAmount = body.amount !== undefined ? Number(body.amount) : remaining;

        if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
          return respond(400, { error: 'Refund amount must be a positive number.' });
        }
        if (requestedAmount > remaining + 0.005) {
          return respond(400, { error: `Refund amount cannot exceed the $${remaining.toFixed(2)} remaining on this order.` });
        }

        const idempotencyKey = buildRefundIdempotencyKey(orderId, requestedAmount, alreadyRefunded);

        let paypalResult;
        try {
          paypalResult = await refundCapture(order.paypalTransactionId, {
            amount: requestedAmount,
            currency: 'USD',
            idempotencyKey,
          });
        } catch (err) {
          console.error(`PayPal refund failed for order ${orderId}:`, err);
          // Nothing in the database has changed at this point.
          return respond(502, { error: err.message });
        }

        const updated = await recordRefund(orderId, {
          refundId: paypalResult.id,
          amount: requestedAmount,
          currency: 'USD',
          expectedRefundedAmountSoFar: alreadyRefunded,
        });

        if (!updated) {
          // PayPal succeeded but our own conditional write didn't apply.
          // The refund itself is real and already happened.
          return respond(409, {
            error: 'The PayPal refund succeeded, but the order record could not be updated because it changed at the same time. Refresh and check the order before retrying.',
            paypalRefundId: paypalResult.id,
          });
        }

        return respond(200, updated);
      }

      default:
        return respond(404, { error: `No handler for route: ${event.routeKey}` });
    }
  } catch (err) {
    console.error('Admin orders request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
