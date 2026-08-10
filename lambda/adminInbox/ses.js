// ses.js
// Sends the admin's reply email to a contact message. From richard@ so
// replies come from him directly (not noreply@).
//
// Uses SendRawEmail (not the simpler SendEmail) specifically so we can set
// Message-ID / In-Reply-To / References headers ourselves -- these are how
// real email systems reliably thread conversations, rather than guessing
// from subject text. A generated Message-ID is returned so the caller can
// store it, and future replies can chain off it correctly.

const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');
const { randomUUID } = require('crypto');

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ADMIN_ADDRESS = process.env.SES_ADMIN_ADDRESS || 'richard@sixspurranch.org';
const MESSAGE_ID_DOMAIN = process.env.MESSAGE_ID_DOMAIN || 'sixspurranch.org';

/**
 * Prepends "Re: " only if the subject doesn't already start with it
 * (case-insensitive) -- previously this always prepended unconditionally,
 * which turned "Re: General Inquiries" into "Re: Re: General Inquiries"
 * on every reply, and that doubled (then tripled...) subject was a big
 * part of why conversations were splitting into separate threads.
 */
function buildReplySubject(subject) {
  const trimmed = (subject || '').trim();
  if (!trimmed) return 'Re: Your message to Six Spur Ranch and Rescue';
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

function escapeHeaderValue(value) {
  // Strip CR/LF from anything going into a raw header line -- basic
  // protection against header injection via a crafted subject/address.
  return String(value || '').replace(/[\r\n]+/g, ' ');
}

/**
 * Sends the reply and returns the Message-ID we generated for it, so the
 * caller can store it as this new message's own emailMessageId (letting
 * the *next* reply in this conversation chain off it reliably).
 *
 * inReplyToEmailMessageId: the real email Message-ID (header value, e.g.
 * "<abc123@mail.gmail.com>") of the message being replied to -- NOT our
 * internal DynamoDB messageId. Optional; if omitted, the outgoing email
 * just won't declare what it's replying to (fine for a first message).
 */
async function sendReply({ toEmail, subject, replyText, inReplyToEmailMessageId }) {
  const finalSubject = buildReplySubject(subject);
  const newMessageId = `<${randomUUID()}@${MESSAGE_ID_DOMAIN}>`;

  const headers = [
    `From: Six Spur Ranch and Rescue <${ADMIN_ADDRESS}>`,
    `To: ${escapeHeaderValue(toEmail)}`,
    `Subject: ${escapeHeaderValue(finalSubject)}`,
    `Message-ID: ${newMessageId}`,
  ];

  if (inReplyToEmailMessageId) {
    const safeInReplyTo = escapeHeaderValue(inReplyToEmailMessageId);
    headers.push(`In-Reply-To: ${safeInReplyTo}`);
    headers.push(`References: ${safeInReplyTo}`);
  }

  headers.push('MIME-Version: 1.0');
  headers.push('Content-Type: text/plain; charset=UTF-8');

  const rawMessage = headers.join('\r\n') + '\r\n\r\n' + replyText;

  await ses.send(
    new SendRawEmailCommand({
      RawMessage: { Data: Buffer.from(rawMessage, 'utf-8') },
    })
  );

  return { emailMessageId: newMessageId, subject: finalSubject };
}

module.exports = { sendReply };
