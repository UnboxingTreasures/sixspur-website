// notify.js
// Notifies Richard (and everyone else currently verified) of a new
// adoption application: SES email + SNS SMS. Failures here don't block
// the application from being saved -- the DynamoDB write already
// succeeded by the time this runs.
//
// SMS recipients are looked up dynamically from the sms_recipients
// table at invocation time (see getRecipients.js) -- a number verified
// through the admin "Text Alert Recipients" UI starts receiving texts
// immediately, no redeploy required.

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { getVerifiedRecipients } = require('./getRecipients');

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

const NOREPLY_ADDRESS = process.env.SES_NOREPLY_ADDRESS || 'noreply@sixspurranch.org';
const ADMIN_ADDRESS = process.env.SES_ADMIN_ADDRESS || 'richard@sixspurranch.org';

async function notifyAdminByEmail({ firstName, lastName, interestedIn, applicationId }) {
  const params = {
    Source: NOREPLY_ADDRESS,
    Destination: { ToAddresses: [ADMIN_ADDRESS] },
    Message: {
      Subject: { Data: `New Adoption Application: ${interestedIn}` },
      Body: {
        Text: {
          Data:
            `${firstName} ${lastName} submitted an adoption application for: ${interestedIn}.\n\n` +
            `Review it in the admin panel:\n` +
            `https://sixspurranch.org/admin/adoptions/${applicationId}`,
        },
      },
    },
  };

  await ses.send(new SendEmailCommand(params));
}

/**
 * Texts every currently-verified recipient. Each send is independent --
 * one bad/unverified number failing doesn't stop the others from going
 * out, matching the existing "notifications never block the real work"
 * philosophy already used for the email/SMS split above this.
 */
async function notifyAdminBySms({ firstName, lastName, interestedIn }) {
  const message = `New adoption application from ${firstName} ${lastName} for: ${interestedIn}. Check the admin Adoptions page for the full PDF.`;

  const recipients = await getVerifiedRecipients();
  const results = await Promise.allSettled(
    recipients.map((phone) => sns.send(new PublishCommand({ Message: message, PhoneNumber: phone })))
  );

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    console.error(`notifyAdminBySms: failed for ${failures.length}/${recipients.length} recipient(s)`, failures);
  }
}

async function notifyAdmin(data) {
  const results = await Promise.allSettled([notifyAdminByEmail(data), notifyAdminBySms(data)]);
  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    console.error('notifyAdmin: one or more notifications failed', failures);
  }
}

module.exports = { notifyAdmin };
