// index.js
// Admin routes for viewing and managing donation records.
//   GET   /admin/donations             — list all
//   GET   /admin/donations/{id}        — one donation
//   PATCH /admin/donations/{id}        — status and notes only (NOT for refunds -- see below), no delete, see dynamo.js
//   POST  /admin/donations/{id}/refund — real PayPal refund, full or partial
//
// No manual-entry route -- considered, built, then deliberately dropped.
// All donations come through the real PayPal checkout flow (see the
// donate Lambda). Offline gifts (checks, cash) are tracked by the
// client outside this system.
//
// AUTH: every route here requires a verified JWT (via the same
// authorizer protecting /donor/* and /donate/*) AND isAdmin=true on
// the donor record -- see requireAdmin() in adminAuth.js. This was the
// only real protection missing here; Basic Auth on the admin PAGES was
// never a substitute for auth on the API routes themselves.
//
// UPDATED -- real refund automation. Previously "Mark as Refunded" was
// PATCH /admin/donations/{id} with {status: 'refunded'} -- pure
// record-keeping, no actual money moved. That's now blocked outright
// (PATCH rejects a 'refunded'/'partially_refunded' status value) and
// replaced with this dedicated route, which:
//   1. Validates the donation can actually be refunded (has a PayPal
//      transaction ID, isn't already fully refunded, requested amount
//      doesn't exceed what's left to refund)
//   2. Calls PayPal's refund API FIRST, with an idempotency key so a
//      retried request can't double-refund
//   3. Only updates DynamoDB AFTER PayPal confirms success -- if PayPal
//      fails, nothing in the database changes, so there's no possibility
//      of a donation showing "refunded" when no money actually moved
//   4. If PayPal succeeds but the DynamoDB write somehow fails, the
//      idempotency key means a retry of the exact same request reaches
//      PayPal's cached result instead of refunding twice, then
//      successfully completes the DynamoDB write on that retry

const { listAll, getById, updateDonation, recordRefund, buildRefundIdempotencyKey } = require('./dynamo');
const { refundCapture } = require('./paypal');
const { requireAdmin } = require('./adminAuth');

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
        // Refund status values must go through POST .../refund instead,
        // which is the only path that also does the actual PayPal call
        // and the refundedAmount/refundHistory bookkeeping. Allowing
        // them here would let someone mark a donation "refunded" with
        // zero money having moved -- exactly the gap this whole feature
        // exists to close.
        if (body.status === 'refunded' || body.status === 'partially_refunded') {
          return respond(400, {
            error: 'Use POST /admin/donations/{id}/refund to process a real refund -- this endpoint no longer accepts a refunded status directly.',
          });
        }
        try {
          const updated = await updateDonation(donationId, body);
          if (!updated) return respond(404, { error: 'Donation not found' });
          return respond(200, updated);
        } catch (err) {
          return respond(400, { error: err.message });
        }
      }

      case 'POST /admin/donations/{id}/refund': {
        const donation = await getById(donationId);
        if (!donation) return respond(404, { error: 'Donation not found' });

        if (!donation.paypalTransactionId) {
          return respond(400, { error: 'This donation has no PayPal transaction on record and cannot be refunded automatically.' });
        }

        const alreadyRefunded = donation.refundedAmount || 0;
        const remaining = Math.round((donation.amount - alreadyRefunded) * 100) / 100;

        if (remaining <= 0) {
          return respond(400, { error: 'This donation has already been fully refunded.' });
        }

        // Default to a full refund of whatever remains -- an admin only
        // needs to specify `amount` for a deliberate partial refund.
        const requestedAmount = body.amount !== undefined ? Number(body.amount) : remaining;

        if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
          return respond(400, { error: 'Refund amount must be a positive number.' });
        }
        if (requestedAmount > remaining + 0.005) {
          return respond(400, { error: `Refund amount cannot exceed the $${remaining.toFixed(2)} remaining on this donation.` });
        }

        const idempotencyKey = buildRefundIdempotencyKey(donationId, requestedAmount, alreadyRefunded);

        let paypalResult;
        try {
          paypalResult = await refundCapture(donation.paypalTransactionId, {
            amount: requestedAmount,
            currency: donation.currency || 'USD',
            idempotencyKey,
          });
        } catch (err) {
          console.error(`PayPal refund failed for donation ${donationId}:`, err);
          // Nothing in the database has changed at this point -- the
          // donation is exactly as it was before this request.
          return respond(502, { error: err.message });
        }

        const updated = await recordRefund(donationId, {
          refundId: paypalResult.id,
          amount: requestedAmount,
          currency: donation.currency || 'USD',
          expectedRefundedAmountSoFar: alreadyRefunded,
        });

        if (!updated) {
          // PayPal succeeded but our own conditional write didn't apply
          // (race with another update, or the donation record changed
          // underneath us). The refund itself is real and already
          // happened -- surface a clear message rather than silently
          // reporting success or failure that doesn't match reality.
          return respond(409, {
            error: 'The PayPal refund succeeded, but the donation record could not be updated because it changed at the same time. Refresh and check the donation before retrying.',
            paypalRefundId: paypalResult.id,
          });
        }

        return respond(200, updated);
      }

      default:
        return respond(404, { error: `No handler for route: ${event.routeKey}` });
    }
  } catch (err) {
    console.error('Admin donations request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
