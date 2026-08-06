// sendContactEmail.js
// Sends two emails on a new contact form submission:
//   1. Auto-reply confirmation to the person who submitted the form (from noreply@)
//   2. Notification to Richard so he knows a new message is waiting (from noreply@,
//      reply-to richard@ so a direct reply lands in his own inbox as a fallback)
// Ported from Unboxing Treasures order-confirmation pattern — order/shipping content
// replaced with adoption/donation/volunteer/general contact copy.

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

const NOREPLY_ADDRESS = process.env.SES_NOREPLY_ADDRESS || 'noreply@sixspurranch.org';
const ADMIN_ADDRESS = process.env.SES_ADMIN_ADDRESS || 'richard@sixspurranch.org';

/**
 * Sends the auto-reply confirmation to the person who submitted the contact form.
 */
async function sendConfirmationToSender({ fromName, fromEmail, subject }) {
  const params = {
    Source: NOREPLY_ADDRESS,
    Destination: { ToAddresses: [fromEmail] },
    Message: {
      Subject: { Data: `We received your message — Six Spur Ranch and Rescue` },
      Body: {
        Text: {
          Data:
            `Hi ${fromName},\n\n` +
            `Thanks for reaching out to Six Spur Ranch and Rescue. We received your message ` +
            `("${subject}") and someone from our team will get back to you soon.\n\n` +
            `If your message is urgent, you can also reach us directly at ${ADMIN_ADDRESS}.`,
        },
      },
    },
  };

  await ses.send(new SendEmailCommand(params));
}

/**
 * Sends the internal notification to Richard that a new message came in.
 */
async function sendNotificationToAdmin({ fromName, fromEmail, fromPhone, subject, bodyText, messageId }) {
  const phoneLine = fromPhone ? `Phone: ${fromPhone}\n` : '';

  const params = {
    Source: NOREPLY_ADDRESS,
    Destination: { ToAddresses: [ADMIN_ADDRESS] },
    ReplyToAddresses: [fromEmail],
    Message: {
      Subject: { Data: `New contact message: ${subject}` },
      Body: {
        Text: {
          Data:
            `New message received via the website contact form.\n\n` +
            `From: ${fromName} <${fromEmail}>\n` +
            phoneLine +
            `Subject: ${subject}\n\n` +
            `${bodyText}\n\n` +
            `---\n` +
            `View and reply in the admin inbox: https://sixspurranch.org/admin/inbox/${messageId}`,
        },
      },
    },
  };

  await ses.send(new SendEmailCommand(params));
}

/**
 * Sends both emails for a new contact submission. Runs in parallel; if one
 * fails it won't block the other, but the caller should still check for
 * partial failure and decide whether to surface it (message is already
 * saved to DynamoDB by this point either way).
 */
async function sendContactEmail({ fromName, fromEmail, fromPhone, subject, bodyText, messageId }) {
  const results = await Promise.allSettled([
    sendConfirmationToSender({ fromName, fromEmail, subject }),
    sendNotificationToAdmin({ fromName, fromEmail, fromPhone, subject, bodyText, messageId }),
  ]);

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    console.error('sendContactEmail: one or more emails failed to send', failures);
  }

  return {
    confirmationSent: results[0].status === 'fulfilled',
    notificationSent: results[1].status === 'fulfilled',
  };
}

module.exports = { sendContactEmail };
