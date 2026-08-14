// ses.js
// Sends a single newsletter blast email to one subscriber. Called once
// per active subscriber by index.js -- individual sends, not BCC, since
// each email needs that specific subscriber's own working unsubscribe
// link (email + their unique unsubscribeToken).
//
// KNOWN SCALING LIMIT, noted honestly: this sends sequentially inside a
// single Lambda invocation. Fine at nonprofit mailing-list scale (dozens
// to low hundreds of subscribers, well inside Lambda's execution time
// limit) -- would need real batching/a queue if the list ever grew into
// the thousands. Not a concern at Six Spur's current or realistic
// near-term scale, but worth remembering if that changes.

const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');
const { randomUUID } = require('crypto');

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
const FROM_ADDRESS = process.env.NEWSLETTER_FROM_ADDRESS || 'richard@sixspurranch.org';
const SITE_URL = process.env.SITE_URL || 'https://sixspurranch.org';

function escapeHeaderValue(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildHtmlBody({ subject, description, imageUrl, unsubscribeUrl }) {
  const paragraphs = description
    .split('\n\n')
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;color:#111111;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

  const imageBlock = imageUrl
    ? `<img src="${imageUrl}" alt="" style="max-width:100%;border-radius:8px;margin-bottom:20px;display:block;" />`
    : '';

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h1 style="font-size:20px;color:#111111;margin:0 0 20px;">${escapeHtml(subject)}</h1>
      ${imageBlock}
      ${paragraphs}
      <hr style="border:none;border-top:1px solid #E8E2DC;margin:32px 0 16px;" />
      <p style="font-size:12px;color:#9CA3AF;">
        You're receiving this because you subscribed to Six Spur Ranch and Rescue's mailing list.
        <a href="${unsubscribeUrl}" style="color:#9CA3AF;">Unsubscribe</a>
      </p>
    </div>
  `.trim();
}

/**
 * Sends one blast email. Returns nothing on success; throws on failure --
 * caller (index.js) wraps each call so one bad address doesn't stop the
 * rest of the list from getting sent to.
 */
async function sendNewsletterEmail({ toEmail, unsubscribeToken, subject, description, imageUrl }) {
  const unsubscribeUrl = `${SITE_URL}/unsubscribe?email=${encodeURIComponent(toEmail)}&token=${encodeURIComponent(unsubscribeToken)}`;
  const html = buildHtmlBody({ subject, description, imageUrl, unsubscribeUrl });
  const messageId = `<${randomUUID()}@sixspurranch.org>`;

  const headers = [
    `From: Six Spur Ranch and Rescue <${FROM_ADDRESS}>`,
    `To: ${escapeHeaderValue(toEmail)}`,
    `Subject: ${escapeHeaderValue(subject)}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
  ];

  const rawMessage = headers.join('\r\n') + '\r\n\r\n' + html;

  await ses.send(new SendRawEmailCommand({
    RawMessage: { Data: Buffer.from(rawMessage, 'utf-8') },
  }));
}

module.exports = { sendNewsletterEmail };
