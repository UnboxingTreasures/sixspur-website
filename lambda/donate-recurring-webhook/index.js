// index.js
// PayPal webhook receiver for recurring donation subscription events.
// PUBLIC route -- sits OUTSIDE the Cognito JWT authorizer entirely,
// since these calls come from PayPal's servers, not a logged-in donor.
// Authenticity is instead verified via PayPal's own webhook signature
// check (verifyWebhookSignature in ./paypal.js) before anything in the
// payload is trusted.
//
// This is the SOURCE OF TRUTH for subscription state -- both
// site-initiated cancellations (lambda/donate-recurring calls PayPal's
// cancel API but doesn't touch the DB itself) and donor-initiated
// cancellations from paypal.com directly land here and update the same
// way, so the two paths can never drift apart.

const { verifyWebhookSignature } = require('./paypal');
const { getSubscriptionById, updateSubscriptionStatus, incrementFailedPayments } = require('./dynamo');
const { createDonationFromCapture, updateDonationReceipt } = require('./donations-dynamo');
const { generateAndSendReceipt } = require('./receipt'); // TODO: copy from lambda/donate/receipt.js -- see chat

function respond(statusCode, body = {}) {
  return { statusCode, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  let webhookEvent;
  try {
    webhookEvent = JSON.parse(event.body);
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  const headers = event.headers || {};
  const verified = await verifyWebhookSignature({
    transmissionId: headers['paypal-transmission-id'],
    transmissionTime: headers['paypal-transmission-time'],
    certUrl: headers['paypal-cert-url'],
    authAlgo: headers['paypal-auth-algo'],
    transmissionSig: headers['paypal-transmission-sig'],
    webhookEvent,
  });

  if (!verified) {
    console.error('PayPal webhook signature verification failed:', webhookEvent.id);
    return respond(400, { error: 'Signature verification failed' });
  }

  const resource = webhookEvent.resource || {};
  // billing_agreement_id is the subscription ID on PAYMENT.SALE.COMPLETED
  // events (resource.id there is the transaction/sale ID instead) --
  // for BILLING.SUBSCRIPTION.* events, billing_agreement_id doesn't
  // exist on the resource at all, so this correctly falls through to
  // resource.id in that case.
  const subscriptionId = resource.billing_agreement_id || resource.id;

  try {
    switch (webhookEvent.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        await updateSubscriptionStatus(subscriptionId, 'active', {
          activatedAt: new Date().toISOString(),
          nextBillingAt: resource.billing_info?.next_billing_time || null,
        });
        break;
      }

      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        await updateSubscriptionStatus(subscriptionId, 'suspended', {
          suspendedAt: new Date().toISOString(),
        });
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        await updateSubscriptionStatus(subscriptionId, 'cancelled', {
          cancelledAt: new Date().toISOString(),
        });
        break;
      }

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        await incrementFailedPayments(subscriptionId);
        break;
      }

      case 'PAYMENT.SALE.COMPLETED': {
        // For subscription charges, resource.billing_agreement_id is the
        // subscription ID -- not present on one-time Orders v2 captures,
        // so this event type only matters here for recurring charges.
        if (!subscriptionId) break;

        const record = await getSubscriptionById(subscriptionId);
        if (!record) {
          console.error('PAYMENT.SALE.COMPLETED for unknown subscription:', subscriptionId);
          break;
        }

        const donation = await createDonationFromCapture({
          donorId: record.donorId,
          donorEmail: record.donorEmail,
          amount: Number(resource.amount.total),
          currency: resource.amount.currency,
          paypalTransactionId: resource.id,
          type: 'recurring',
        });

        await updateSubscriptionStatus(subscriptionId, 'active', {
          lastPaymentAt: new Date().toISOString(),
          failedPaymentCount: 0, // a successful charge resets the streak
        });

        try {
          const receiptUrl = await generateAndSendReceipt(donation);
          await updateDonationReceipt(donation.donationId, receiptUrl);
        } catch (receiptErr) {
          console.error(`Recurring donation ${donation.donationId} charged but receipt failed:`, receiptErr);
        }
        break;
      }

      default:
        // Other event types (payment method changes, etc.) aren't
        // tracked -- acknowledge and move on so PayPal doesn't retry.
        break;
    }

    return respond(200, { received: true });
  } catch (err) {
    console.error('Webhook processing failed:', webhookEvent.event_type, err);
    // Return 500 so PayPal retries -- this is a real processing failure,
    // not a signature/validation rejection.
    return respond(500, { error: 'Processing failed' });
  }
};
