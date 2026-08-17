// notify.js
// Texts admin staff when a one-time donation completes. Same
// SMS_RECIPIENTS pattern already established in adoptionApplication and
// contactForm -- comma-separated list, falls back to the old single
// RICHARD_PHONE_NUMBER var if unset. Failures here never affect the
// donation itself -- the DynamoDB write and receipt email already
// happened by the time this runs, same "notifications never block the
// real work" philosophy used everywhere else in this project.

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
async function notifyAdminOfDonation({ amount, currency, donorEmail, campaignTitle }) {
  const campaignNote = campaignTitle ? ` (${campaignTitle})` : '';
  const message = `New donation: $${amount.toFixed(2)} ${currency} from ${donorEmail}${campaignNote}. Check the admin Donations page for details.`;

  const results = await Promise.allSettled(
    SMS_RECIPIENTS.map((phone) => sns.send(new PublishCommand({ Message: message, PhoneNumber: phone })))
  );

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    console.error(`notifyAdminOfDonation: failed for ${failures.length}/${SMS_RECIPIENTS.length} recipient(s)`, failures);
  }
}

module.exports = { notifyAdminOfDonation };
