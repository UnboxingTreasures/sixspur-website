// notify.js
// Notifies Richard of a new adoption application, same pattern as the
// general contact form: SES email + SNS SMS. Failures here don't block the
// application from being saved — the DynamoDB write already succeeded by
// the time this runs.

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

const NOREPLY_ADDRESS = process.env.SES_NOREPLY_ADDRESS || 'noreply@sixspurranch.org';
const ADMIN_ADDRESS = process.env.SES_ADMIN_ADDRESS || 'richard@sixspurranch.org';
const RICHARD_PHONE = process.env.RICHARD_PHONE_NUMBER || '+18137866333';

async function notifyAdminByEmail({ firstName, lastName, interestedIn, messageId }) {
  const params = {
    Source: NOREPLY_ADDRESS,
    Destination: { ToAddresses: [ADMIN_ADDRESS] },
    Message: {
      Subject: { Data: `New Adoption Application: ${interestedIn}` },
      Body: {
        Text: {
          Data:
            `${firstName} ${lastName} submitted an adoption application for: ${interestedIn}.\n\n` +
            `View the full application and download the PDF in the admin inbox:\n` +
            `https://sixspurranch.org/admin/inbox/${messageId}`,
        },
      },
    },
  };

  await ses.send(new SendEmailCommand(params));
}

async function notifyAdminBySms({ firstName, lastName, interestedIn }) {
  const message = `New adoption application from ${firstName} ${lastName} for: ${interestedIn}. Check the admin inbox for the full PDF.`;
  await sns.send(new PublishCommand({ Message: message, PhoneNumber: RICHARD_PHONE }));
}

async function notifyAdmin(data) {
  const results = await Promise.allSettled([notifyAdminByEmail(data), notifyAdminBySms(data)]);
  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    console.error('notifyAdmin: one or more notifications failed', failures);
  }
}

module.exports = { notifyAdmin };
