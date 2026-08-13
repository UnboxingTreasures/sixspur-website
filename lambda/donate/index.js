// index.js
// One-time donation checkout, protected by the same Cognito JWT
// authorizer as /donor/* routes -- donations require an account per the
// Aug 11 scoping decision, so there's no anonymous/guest path here.
//
//   POST /donate/create-order   — creates a PayPal order, returns its ID for the frontend's PayPal button
//   POST /donate/capture-order  — captures a donor-approved order, records the donation, sends the receipt
//
// Accepts an optional campaignId in the body on both routes -- passed
// through untouched on create (PayPal doesn't need to know about it),
// stored on the donation record on capture so it counts toward that
// fundraiser's live total.
//
// Recurring/monthly donations are NOT handled by this Lambda -- separate,
// not-yet-built work, see the recurring donations design doc.

const { createOrder, captureOrder } = require('./paypal');
const { createDonationFromCapture, updateDonationReceipt } = require('./dynamo');
const { generateAndSendReceipt } = require('./receipt');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

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
      case 'POST /donate/create-order': {
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          return respond(400, { error: 'A valid donation amount is required' });
        }
        const order = await createOrder(amount);
        return respond(200, { paypalOrderId: order.id });
      }

      case 'POST /donate/capture-order': {
        const paypalOrderId = body.paypalOrderId;
        if (!paypalOrderId) return respond(400, { error: 'paypalOrderId is required' });

        const captureResult = await captureOrder(paypalOrderId);

        const capture = captureResult.purchase_units?.[0]?.payments?.captures?.[0];
        if (!capture || capture.status !== 'COMPLETED') {
          console.error('Unexpected capture result:', JSON.stringify(captureResult));
          return respond(502, { error: 'Payment could not be confirmed. Please try again or contact us.' });
        }

        const donation = await createDonationFromCapture({
          donorId: donor.donorId,
          donorEmail: donor.email,
          amount: Number(capture.amount.value),
          currency: capture.amount.currency_code,
          paypalTransactionId: capture.id,
          campaignId: body.campaignId || undefined,
        });

        try {
          const receiptUrl = await generateAndSendReceipt(donation);
          donation.receiptUrl = receiptUrl;
          // The fix: actually persist it, not just mutate the in-memory
          // object being returned below. Without this, the download
          // link only ever worked on the very first response and
          // silently vanished on every later page load.
          await updateDonationReceipt(donation.donationId, receiptUrl);
        } catch (receiptErr) {
          console.error(`Donation ${donation.donationId} captured but receipt generation failed:`, receiptErr);
        }

        return respond(200, donation);
      }

      default:
        return respond(404, { error: `No handler for route: ${event.routeKey}` });
    }
  } catch (err) {
    console.error('Donation checkout failed:', err);
    return respond(500, { error: 'Something went wrong processing your donation. You have not been charged if this error occurred before confirmation.' });
  }
};
