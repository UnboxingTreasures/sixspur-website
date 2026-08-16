// index.js
// API Gateway handler for POST /contact
// Orchestrates: validate -> save to DynamoDB -> send emails -> text
// admins via SNS. Ported from Unboxing Treasures contact/order-
// notification pattern.
//
// UPDATED -- SMS now goes to every number in SMS_RECIPIENTS (comma-
// separated), not just one hardcoded number. Falls back to the old
// single RICHARD_PHONE_NUMBER var if SMS_RECIPIENTS isn't set.

const { saveContactMessage } = require('./saveContactMessage');
const { sendContactEmail } = require('./sendContactEmail');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

const SMS_RECIPIENTS = (process.env.SMS_RECIPIENTS || process.env.RICHARD_PHONE_NUMBER || '+18137866333')
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean);

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
 * Texts every number in SMS_RECIPIENTS. Each send is independent -- one
 * bad/unverified number failing doesn't stop the others from going out.
 * Returns true if AT LEAST ONE recipient got the text, matching the
 * original single-recipient boolean's meaning as closely as possible.
 */
async function notifyRichardBySms({ fromName, subject }) {
  const message =
    `New Six Spur contact message from ${fromName}: "${subject}". ` +
    `Check the admin inbox for details.`;

  const results = await Promise.allSettled(
    SMS_RECIPIENTS.map((phone) => sns.send(new PublishCommand({ Message: message, PhoneNumber: phone })))
  );

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    // SMS failure shouldn't fail the whole request — message is already
    // saved and the email notification is the primary channel.
    console.error(`notifyRichardBySms: failed for ${failures.length}/${SMS_RECIPIENTS.length} recipient(s)`, failures);
  }

  return failures.length < SMS_RECIPIENTS.length;
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
