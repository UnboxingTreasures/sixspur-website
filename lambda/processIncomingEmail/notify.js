// notify.js
// Texts admin staff when a real inbound email is received and saved --
// distinct from the public contact form's own SMS notification
// (lambda/contactForm/index.js), which fires on the INITIAL form
// submission. This one fires for genuine inbound email traffic to
// richard@sixspurranch.org: replies to an existing thread, or a fresh
// email sent directly to that address rather than through the form.
//
// Same SMS_RECIPIENTS pattern already established elsewhere --
// comma-separated list, falls back to the old single
// RICHARD_PHONE_NUMBER var if unset. Failures here never affect the
// actual message processing -- the DynamoDB write already succeeded
// by the time this runs (see index.js's saveInboundMessage call).

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

const SMS_RECIPIENTS = (process.env.SMS_RECIPIENTS || process.env.RICHARD_PHONE_NUMBER || '+18137866333')
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean);

/**
 * Texts every number in SMS_RECIPIENTS. Each send is independent -- one
 * bad/unverified number failing doesn't stop the others from going out.
 */
async function notifyAdminOfEmail({ fromName, fromEmail, subject }) {
  const message = `New email from ${fromName} <${fromEmail}>: "${subject}". Check the admin inbox for details.`;

  const results = await Promise.allSettled(
    SMS_RECIPIENTS.map((phone) => sns.send(new PublishCommand({ Message: message, PhoneNumber: phone })))
  );

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    console.error(`notifyAdminOfEmail: failed for ${failures.length}/${SMS_RECIPIENTS.length} recipient(s)`, failures);
  }
}

module.exports = { notifyAdminOfEmail };
