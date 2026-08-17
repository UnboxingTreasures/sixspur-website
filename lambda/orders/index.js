// index.js
// Shop checkout -- full cart, guest-by-default with optional donor
// login (Aug 14, 2026 scoping decision).
//
//   POST /orders/create-order   — validates cart, quotes PayPal, reserves stock atomically
//   POST /orders/capture-order  — captures a buyer-approved order, marks it paid
//
// FLOW, and why it's in this order (see dynamo.js for the reservation
// details):
//   1. Price the cart from LIVE product data (buildReservationPlan,
//      read-only at this point).
//   2. Create the PayPal order for that total. This is a quote, not a
//      charge -- no money moves yet.
//   3. Atomically reserve stock for every cart line AND create the
//      pending order record, in one DynamoDB transaction.
//   4. If step 3 fails (something sold out), the PayPal order from
//      step 2 is simply never captured -- it expires on PayPal's side
//      on its own. No charge ever happened, so there's nothing to
//      refund. The buyer sees exactly which item(s) sold out.
//   5. Frontend renders the PayPal buttons against the returned
//      paypalOrderId. On approval, it calls capture-order, which calls
//      PayPal's capture (the actual charge) and only THEN flips our
//      order to 'paid'.
//
// UNLIKE /donate/* and /admin/*, these two routes are NOT gated by the
// Cognito JWT authorizer at API Gateway (all-or-nothing per route). So
// this Lambda verifies the token itself, ONLY if one is present, using
// aws-jwt-verify against the same Cognito user pool the donor/admin
// routes already use. No header -> guest checkout.
//
// UPDATED -- texts admin staff (see notify.js) when an order is placed,
// same SMS_RECIPIENTS pattern used across the project.

const { CognitoJwtVerifier } = require('aws-jwt-verify');
const { createOrder: createPaypalOrder, captureOrder: capturePaypalOrder } = require('./paypal');
const {
  buildReservationPlan, reserveCartAndCreateOrder, getOrder, getOrdersByDonor, markOrderPaid, getShippingRate, getMailingAddress,
} = require('./dynamo');
const { sendOrderConfirmation } = require('./email');
const { notifyAdminOfOrder } = require('./notify');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: 'id',
  clientId: process.env.COGNITO_CLIENT_ID,
});

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * Returns { donorId, email } for a valid token, or null for a guest
 * (no header, or a header that fails verification). Never throws.
 */
async function getOptionalDonor(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, '');
  try {
    const claims = await verifier.verify(token);
    return { donorId: claims.sub, email: claims.email };
  } catch (err) {
    console.warn('Ignoring invalid/expired token on checkout, proceeding as guest:', err.message);
    return null;
  }
}

async function handleCreateOrder(event, body) {
  const { cartItems, shippingAddress, email } = body;

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return respond(400, { error: 'Cart is empty' });
  }
  if (!shippingAddress || !shippingAddress.line1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.zip) {
    return respond(400, { error: 'A complete shipping address is required' });
  }

  const donor = await getOptionalDonor(event);
  const buyerEmail = donor?.email || email;
  if (!buyerEmail) {
    return respond(400, { error: 'An email address is required' });
  }

  let plan;
  try {
    plan = await buildReservationPlan(cartItems);
  } catch (err) {
    return respond(400, { error: err.message });
  }

  let paypalOrder;
  try {
    paypalOrder = await createPaypalOrder(plan.total);
  } catch (err) {
    console.error('PayPal quote failed:', err);
    return respond(502, { error: 'Could not start checkout with PayPal. Please try again.' });
  }

  let order;
  try {
    order = await reserveCartAndCreateOrder({
      cartItems,
      donorId: donor?.donorId || null,
      email: buyerEmail,
      shippingAddress,
      paypalOrderId: paypalOrder.id,
    });
  } catch (err) {
    if (err.code === 'OUT_OF_STOCK') {
      return respond(409, { error: err.message, failedItemIds: err.failedItemIds });
    }
    console.error('Stock reservation failed:', err);
    return respond(500, { error: 'Could not reserve your items. Please try again.' });
  }

  return respond(200, { orderId: order.orderId, paypalOrderId: order.paypalOrderId, total: order.total });
}

async function handleCaptureOrder(body) {
  const { orderId } = body;
  if (!orderId) return respond(400, { error: 'orderId is required' });

  const order = await getOrder(orderId);
  if (!order) return respond(404, { error: 'Order not found' });

  if (order.status !== 'pending') {
    return respond(409, { error: `This order is no longer pending (status: ${order.status}). If your cart reservation expired, please check out again.` });
  }
  if (new Date(order.reservationExpiresAt) < new Date()) {
    return respond(409, { error: 'Your reservation window expired. Please check out again.' });
  }

  const captureResult = await capturePaypalOrder(order.paypalOrderId);
  const capture = captureResult.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture || capture.status !== 'COMPLETED') {
    console.error('Unexpected capture result:', JSON.stringify(captureResult));
    return respond(502, { error: 'Payment could not be confirmed. Please try again or contact us.' });
  }

  const updated = await markOrderPaid(orderId, { paypalTransactionId: capture.id });
  if (!updated) {
    console.error(`CRITICAL: PayPal capture ${capture.id} succeeded for order ${orderId} but the order could not be marked paid (already expired?). Manual reconciliation needed.`);
    return respond(500, { error: 'Payment was received but we could not finalize your order. Please contact us so we can sort this out.' });
  }

  try {
    await sendOrderConfirmation(updated);
  } catch (emailErr) {
    console.error(`Order ${orderId} captured successfully but confirmation email failed to send:`, emailErr);
  }

  try {
    await notifyAdminOfOrder(updated);
  } catch (smsErr) {
    console.error(`Order ${orderId} captured successfully but SMS notification failed:`, smsErr);
  }

  return respond(200, updated);
}

async function handleGetMyOrders(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims?.sub) return respond(401, { error: 'Not authenticated' });

  const orders = await getOrdersByDonor(claims.sub);
  return respond(200, { orders });
}

/**
 * Public, unauthenticated -- needs to be readable by anyone browsing
 * checkout, not just logged-in donors. UPDATED (Session 20): now also
 * returns the admin-editable mailing address alongside the shipping
 * rate, so /ways-to-give can display Richard's real current address
 * (e.g. after he moves again) without a code deploy, same reasoning
 * as the shipping rate itself.
 */
async function handleGetShopSettings() {
  const [flatRate, mailingAddress] = await Promise.all([getShippingRate(), getMailingAddress()]);
  return respond(200, { flatRate, mailingAddress });
}

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, {});
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
      case 'POST /orders/create-order': return await handleCreateOrder(event, body);
      case 'POST /orders/capture-order': return await handleCaptureOrder(body);
      case 'GET /orders/mine': return await handleGetMyOrders(event);
      case 'GET /shop-settings': return await handleGetShopSettings();
      default:
        return respond(404, { error: `No handler for route: ${event.routeKey}` });
    }
  } catch (err) {
    console.error('Order checkout failed:', err);
    return respond(500, { error: 'Something went wrong processing your order.' });
  }
};
