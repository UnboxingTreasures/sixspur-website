// notify.js
// Texts admin staff when a one-time donation completes. Recipients are
// looked up dynamically from the sms_recipients table at invocation
// time (see getRecipients.js) -- a number verified through the admin
// "Text Alert Recipients" UI starts receiving texts immediately, no
// redeploy required. Failures here never affect the donation itself --
// the DynamoDB write and receipt email already happened by the time
// this runs, same "notifications never block the real work" philosophy
// used everywhere else in this project.

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { getVerifiedRecipients } = require('./getRecipients');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Texts every currently-verified recipient. Each send is independent --
 * one bad/unverified number failing doesn't stop the others from going out.
 */
async function notifyAdminOfDonation({ amount, currency, donorEmail, campaignTitle }) {
  const campaignNote = campaignTitle ? ` (${campaignTitle})` : '';
  const message = `New donation: $${amount.toFixed(2)} ${currency} from ${donorEmail}${campaignNote}. Check the admin Donations page for details.`;

  const recipients = await getVerifiedRecipients();
  const results = await Promise.allSettled(
    recipients.map((phone) => sns.send(new PublishCommand({ Message: message, PhoneNumber: phone })))
  );

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    console.error(`notifyAdminOfDonation: failed for ${failures.length}/${recipients.length} recipient(s)`, failures);
  }
}

module.exports = { notifyAdminOfDonation };
