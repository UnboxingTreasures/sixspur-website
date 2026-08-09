// notifyApplicant.js
// Sends the applicant an email whenever their status changes. "Open" is the
// default state every new application starts in, not a real transition, so
// no email is sent for it -- only Under Review / Approved / Denied.
//
// The copy below is intentionally generic about next steps (no promises
// about timelines, who will call, etc.) since that process may differ
// per-animal or per-applicant. Richard/Jay should feel free to adjust the
// wording here to match how the ranch actually follows up.

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
const NOREPLY_ADDRESS = process.env.SES_NOREPLY_ADDRESS || 'noreply@sixspurranch.org';

const SUBJECTS = {
  'Under Review': 'Your Six Spur Ranch adoption application is under review',
  'Approved': 'Your Six Spur Ranch adoption application has been approved!',
  'Denied': 'An update on your Six Spur Ranch adoption application',
};

function bodyFor(status, firstName, interestedIn) {
  switch (status) {
    case 'Under Review':
      return (
        `Hi ${firstName},\n\n` +
        `Thanks for your patience — your adoption application for ${interestedIn} is now under review. ` +
        `We'll be in touch soon with next steps.\n\n` +
        `If you have any questions in the meantime, just reply to this email.\n\n` +
        `— Six Spur Ranch and Rescue`
      );
    case 'Approved':
      return (
        `Hi ${firstName},\n\n` +
        `Great news — your adoption application for ${interestedIn} has been approved! ` +
        `We're excited to move forward. Someone from our team will reach out shortly to coordinate next steps.\n\n` +
        `— Six Spur Ranch and Rescue`
      );
    case 'Denied':
      return (
        `Hi ${firstName},\n\n` +
        `Thank you for your interest in adopting ${interestedIn}, and for taking the time to apply. ` +
        `After careful review, we're not able to move forward with this application at this time.\n\n` +
        `We truly appreciate your support of our rescue, and we'd welcome an application from you again in the future.\n\n` +
        `— Six Spur Ranch and Rescue`
      );
    default:
      return null;
  }
}

async function notifyApplicantOfStatusChange({ status, firstName, primaryEmail, interestedIn }) {
  const subject = SUBJECTS[status];
  const body = bodyFor(status, firstName, interestedIn);
  if (!subject || !body) return; // no email for "Open" or any unrecognized status

  await ses.send(new SendEmailCommand({
    Source: NOREPLY_ADDRESS,
    Destination: { ToAddresses: [primaryEmail] },
    Message: {
      Subject: { Data: subject },
      Body: { Text: { Data: body } },
    },
  }));
}

module.exports = { notifyApplicantOfStatusChange };
