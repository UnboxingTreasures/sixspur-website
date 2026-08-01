// ses.js
// Sends the admin's reply email to a contact message. From richard@ so
// replies come from him directly (not noreply@).

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ADMIN_ADDRESS = process.env.SES_ADMIN_ADDRESS || 'richard@sixspurranch.org';

async function sendReply({ toEmail, subject, replyText }) {
  const params = {
    Source: ADMIN_ADDRESS,
    Destination: { ToAddresses: [toEmail] },
    Message: {
      Subject: { Data: subject && subject.trim() ? `Re: ${subject.trim()}` : 'Re: Your message to Six Spur Ranch and Rescue' },
      Body: { Text: { Data: replyText } },
    },
  };

  await ses.send(new SendEmailCommand(params));
}

module.exports = { sendReply };
