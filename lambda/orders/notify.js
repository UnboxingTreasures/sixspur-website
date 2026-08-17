// notify.js
// Texts admin staff when a shop order is placed (captured/paid).
// Recipients are looked up dynamically from the sms_recipients table
// at invocation time (see getRecipients.js) -- a number verified
// through the admin "Text Alert Recipients" UI starts receiving texts
// immediately, no redeploy required. Failures here never affect the
// order itself -- markOrderPaid and the confirmation email already
// happened by the time this runs.

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { getVerifiedRecipients } = require('./getRecipients');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Texts every currently-verified recipient. Each send is independent --
 * one bad/unverified number failing doesn't stop the others from going out.
 */
async function notifyAdminOfOrder(order) {
  const itemCount = (order.items || []).reduce((sum, i) => sum + i.quantity, 0);
  const message = `New order: $${order.total.toFixed(2)} (${itemCount} item${itemCount === 1 ? '' : 's'}) from ${order.email}. Check the admin Orders page for details.`;

  const recipients = await getVerifiedRecipients();
  const results = await Promise.allSettled(
    recipients.map((phone) => sns.send(new PublishCommand({ Message: message, PhoneNumber: phone })))
  );

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    console.error(`notifyAdminOfOrder: failed for ${failures.length}/${recipients.length} recipient(s)`, failures);
  }
}

module.exports = { notifyAdminOfOrder };
