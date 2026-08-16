// email.js
// Refund notification for donations -- first time adminDonations has
// ever sent an email. Mirrors lambda/adminOrders/email.js's
// sendRefundNotification pattern exactly, same SES send, same
// FROM_ADDRESS convention.
//
// Called from index.js's POST /admin/donations/{id}/refund handler
// AFTER recordRefund succeeds, wrapped in its own try/catch there --
// a failed email must never undo or fail a refund that's already real
// money, already moved. Same reasoning as every other post-write email
// in this project.

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
const FROM_ADDRESS = process.env.SYSTEM_FROM_EMAIL || 'noreply@sixspurranch.org';

async function sendRefundNotification(donation, refundAmount, isFullRefund) {
  const remaining = Math.round((donation.amount - (donation.refundedAmount || 0)) * 100) / 100;
  const partialNote = isFullRefund
    ? ''
    : `\nThis was a partial refund. $${remaining.toFixed(2)} of your original $${donation.amount.toFixed(2)} donation remains unrefunded.\n`;
  const partialNoteHtml = isFullRefund
    ? ''
    : `<p style="font-size:13px; color:#888888;">This was a partial refund. $${remaining.toFixed(2)} of your original $${donation.amount.toFixed(2)} donation remains unrefunded.</p>`;

  const textBody = `Your refund from Six Spur Ranch and Rescue has been processed.

Refund Amount: $${refundAmount.toFixed(2)}
${partialNote}
Please allow a few business days for this to appear back on your original payment method via PayPal.

Questions? Just reply to this email.
`;

  const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111111;">
  <h2 style="color:#111111;">Your refund has been processed</h2>

  <p style="font-size:20px; font-weight:bold; margin: 20px 0;">$${refundAmount.toFixed(2)} refunded</p>

  ${partialNoteHtml}

  <p style="font-size:14px; color:#555555;">Please allow a few business days for this to appear back on your original payment method via PayPal.</p>

  <p style="color:#888888; font-size:12px; margin-top:24px;">
    Questions? Just reply to this email.
  </p>
</div>`;

  await ses.send(new SendEmailCommand({
    Source: FROM_ADDRESS,
    Destination: { ToAddresses: [donation.donorEmail] },
    Message: {
      Subject: { Data: `Your refund has been processed — Six Spur Ranch and Rescue` },
      Body: {
        Text: { Data: textBody },
        Html: { Data: htmlBody },
      },
    },
  }));
}

module.exports = { sendRefundNotification };
