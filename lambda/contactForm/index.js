// index.js
// API Gateway handler for POST /contact
// Orchestrates: validate -> save to DynamoDB -> send emails -> text
// admins via SNS. Ported from Unboxing Treasures contact/order-
// notification pattern.
//
// SMS recipients are looked up dynamically from the sms_recipients
// table at invocation time (see getRecipients.js) -- a number verified
// through the admin "Text Alert Recipients" UI starts receiving texts
// immediately, no redeploy required.

const { saveContactMessage } = require('./saveContactMessage');
const { sendContactEmail } = require('./sendContactEmail');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { getVerifiedRecipients } = require('./getRecipients');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Texts every currently-verified recipient. Each send is independent --
 * one bad/unverified number failing doesn't stop the others from going
 * out. Returns true if AT LEAST ONE recipient got the text, matching
 * the original single-recipient boolean's meaning as closely as possible.
 */
async function notifyRichardBySms({ fromName, subject }) {
  const message =
    `New Six Spur contact message from ${fromName}: "${subject}". ` +
    `Check the admin inbox for details.`;

  const recipients = await getVerifiedRecipients();
  const results = await Promise.allSettled(
    recipients.map((phone) => sns.send(new PublishCommand({ Message: message, PhoneNumber: phone })))
  );

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    // SMS failure shouldn't fail the whole request — message is already
    // saved and the email notification is the primary channel.
    console.error(`notifyRichardBySms: failed for ${failures.length}/${recipients.length} recipient(s)`, failures);
  }

  return failures.length < recipients.length;
}

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return respond(200, {});
  }
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return respond(400, { error: 'Invalid JSON body' });
  }
  const { name, email, phone, subject, message } = payload;
  if (!name || !email || !message) {
    return respond(400, { error: 'name, email, and message are required' });
  }
  if (!EMAIL_REGEX.test(email)) {
    return respond(400, { error: 'A valid email address is required' });
  }
  try {
    const { messageId, threadId, receivedAt } = await saveContactMessage({
      fromName: name,
      fromEmail: email,
      fromPhone: phone,
      subject,
      bodyText: message,
    });
    const emailResult = await sendContactEmail({
      fromName: name,
      fromEmail: email,
      fromPhone: phone,
      subject: subject && subject.trim() ? subject.trim() : 'New contact form submission',
      bodyText: message,
      messageId,
    });
    const smsSent = await notifyRichardBySms({
      fromName: name,
      subject: subject && subject.trim() ? subject.trim() : 'New contact form submission',
    });
    return respond(200, {
      success: true,
      messageId,
      threadId,
      receivedAt,
      confirmationSent: emailResult.confirmationSent,
      notificationSent: emailResult.notificationSent,
      smsSent,
    });
  } catch (err) {
    console.error('Contact form submission failed:', err);
    return respond(500, { error: 'Something went wrong. Please try again or email us directly.' });
  }
};
