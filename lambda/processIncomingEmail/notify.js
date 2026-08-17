// notify.js
// Texts admin staff when a real inbound email is received and saved --
// distinct from the public contact form's own SMS notification
// (lambda/contactForm/index.js), which fires on the INITIAL form
// submission. This one fires for genuine inbound email traffic to
// richard@sixspurranch.org: replies to an existing thread, or a fresh
// email sent directly to that address rather than through the form.
//
// Recipients are looked up dynamically from the sms_recipients table
// at invocation time (see getRecipients.js) -- a number verified
// through the admin "Text Alert Recipients" UI starts receiving texts
// immediately, no redeploy required. Failures here never affect the
// actual message processing -- the DynamoDB write already succeeded
// by the time this runs (see index.js's saveInboundMessage call).

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { getVerifiedRecipients } = require('./getRecipients');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Texts every currently-verified recipient. Each send is independent --
 * one bad/unverified number failing doesn't stop the others from going out.
 */
async function notifyAdminOfEmail({ fromName, fromEmail, subject }) {
  const message = `New email from ${fromName} <${fromEmail}>: "${subject}". Check the admin inbox for details.`;

  const recipients = await getVerifiedRecipients();
  const results = await Promise.allSettled(
    recipients.map((phone) => sns.send(new PublishCommand({ Message: message, PhoneNumber: phone })))
  );

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    console.error(`notifyAdminOfEmail: failed for ${failures.length}/${recipients.length} recipient(s)`, failures);
  }
}

module.exports = { notifyAdminOfEmail };
