// index.js
// API Gateway handler for POST /contact
// Orchestrates: validate -> save to DynamoDB -> send emails -> text Richard via SNS
// Ported from Unboxing Treasures contact/order-notification pattern.

const { saveContactMessage } = require('./saveContactMessage');
const { sendContactEmail } = require('./sendContactEmail');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const RICHARD_PHONE = process.env.RICHARD_PHONE_NUMBER || '+18137866333';

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

async function notifyRichardBySms({ fromName, subject }) {
  const message =
    `New Six Spur contact message from ${fromName}: "${subject}". ` +
    `Check the admin inbox for details.`;

  try {
    await sns.send(
      new PublishCommand({
        Message: message,
        PhoneNumber: RICHARD_PHONE,
      })
    );
    return true;
  } catch (err) {
    // SMS failure shouldn't fail the whole request — message is already saved
    // and the email notification is the primary channel.
    console.error('notifyRichardBySms failed:', err);
    return false;
  }
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
