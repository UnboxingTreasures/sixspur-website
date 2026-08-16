// email.js
// Sends the "your order shipped" notification once an admin marks an
// order shipped. Mirrors lambda/orders/email.js's order-confirmation
// pattern exactly -- plain SES send, no PDF/S3 involved, same
// FROM_ADDRESS -- this is just the second email in an order's
// lifecycle (confirmation on purchase, this one on shipment), not a
// new email system.
//
// Called from index.js's PATCH /admin/orders/{id} handler AFTER
// updateOrder succeeds with status: 'shipped', wrapped in its own
// try/catch there -- a failed email must never undo or fail an
// already-recorded shipment, same reasoning as every other
// post-write email in this project (donate receipts, order
// confirmations).

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
const FROM_ADDRESS = process.env.SYSTEM_FROM_EMAIL || 'noreply@sixspurranch.org';

function buildItemsText(items) {
  return items
    .map((line) => {
      const variant = line.variantValues ? ` (${Object.values(line.variantValues).join(' / ')})` : '';
      return `  ${line.quantity} x ${line.name}${variant}`;
    })
    .join('\n');
}

function buildItemsHtml(items) {
  return items
    .map((line) => {
      const variant = line.variantValues
        ? ` <span style="color:#888888;">(${Object.values(line.variantValues).join(' / ')})</span>`
        : '';
      return `<tr><td style="padding:6px 0;">${line.quantity} &times; ${line.name}${variant}</td></tr>`;
    })
    .join('');
}

async function sendShipmentNotification(order) {
  const itemsText = buildItemsText(order.items);
  const itemsHtml = buildItemsHtml(order.items);
  const trackingLine = order.trackingNumber
    ? `Tracking Number: ${order.trackingNumber}`
    : 'No tracking number was provided for this shipment.';

  const textBody = `Good news -- your Six Spur Ranch and Rescue order is on its way!

Order: ${order.orderId}

ITEMS
${itemsText}

${trackingLine}

Every purchase supports the animals at Six Spur Ranch and Rescue. Questions about your order? Just reply to this email.
`;

  const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111111;">
  <h2 style="color:#111111;">Your order is on its way!</h2>
  <p style="color:#555555; font-size:13px;">Order: ${order.orderId}</p>

  <table style="width:100%; border-collapse:collapse; margin:20px 0;">
    ${itemsHtml}
  </table>

  <p style="font-size:14px; ${order.trackingNumber ? 'font-weight:bold;' : 'color:#888888;'}">${trackingLine}</p>

  <p style="color:#888888; font-size:12px; margin-top:24px;">
    Every purchase supports the animals at Six Spur Ranch and Rescue. Questions about your order? Just reply to this email.
  </p>
</div>`;

  await ses.send(new SendEmailCommand({
    Source: FROM_ADDRESS,
    Destination: { ToAddresses: [order.email] },
    Message: {
      Subject: { Data: `Your order has shipped — Six Spur Ranch and Rescue (${order.orderId.slice(0, 8)})` },
      Body: {
        Text: { Data: textBody },
        Html: { Data: htmlBody },
      },
    },
  }));
}

/**
 * Sent after a refund is successfully processed through PayPal (see
 * index.js's POST /admin/orders/{id}/refund). Called AFTER recordRefund
 * succeeds, in its own try/catch there -- same reasoning as the
 * shipment notification above: a failed email must never undo or fail
 * a refund that's already real money, already moved.
 */
async function sendRefundNotification(order, refundAmount, isFullRefund) {
  const remaining = Math.round((order.total - (order.refundedAmount || 0)) * 100) / 100;
  const partialNote = isFullRefund
    ? ''
    : `\nThis was a partial refund. $${remaining.toFixed(2)} of your original $${order.total.toFixed(2)} order remains unrefunded.\n`;
  const partialNoteHtml = isFullRefund
    ? ''
    : `<p style="font-size:13px; color:#888888;">This was a partial refund. $${remaining.toFixed(2)} of your original $${order.total.toFixed(2)} order remains unrefunded.</p>`;

  const textBody = `Your refund from Six Spur Ranch and Rescue has been processed.

Order: ${order.orderId}
Refund Amount: $${refundAmount.toFixed(2)}
${partialNote}
Please allow a few business days for this to appear back on your original payment method via PayPal.

Questions? Just reply to this email.
`;

  const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111111;">
  <h2 style="color:#111111;">Your refund has been processed</h2>
  <p style="color:#555555; font-size:13px;">Order: ${order.orderId}</p>

  <p style="font-size:20px; font-weight:bold; margin: 20px 0;">$${refundAmount.toFixed(2)} refunded</p>

  ${partialNoteHtml}

  <p style="font-size:14px; color:#555555;">Please allow a few business days for this to appear back on your original payment method via PayPal.</p>

  <p style="color:#888888; font-size:12px; margin-top:24px;">
    Questions? Just reply to this email.
  </p>
</div>`;

  await ses.send(new SendEmailCommand({
    Source: FROM_ADDRESS,
    Destination: { ToAddresses: [order.email] },
    Message: {
      Subject: { Data: `Your refund has been processed — Six Spur Ranch and Rescue (${order.orderId.slice(0, 8)})` },
      Body: {
        Text: { Data: textBody },
        Html: { Data: htmlBody },
      },
    },
  }));
}

module.exports = { sendShipmentNotification, sendRefundNotification };
