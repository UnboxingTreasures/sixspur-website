// email.js
// Sends the order confirmation email after a successful PayPal capture.
// Unlike donate's receipt (which generates a PDF tax receipt via
// pdfkit + S3, since donations are tax-deductible), a shop order
// doesn't need a formal receipt document -- just a clear confirmation
// of what was bought, where it's shipping, and the total charged. Kept
// as plain SES send, no PDF/S3 involved.
//
// Sent from noreply@sixspurranch.org, same as every other system email
// in this project (Section 7 of the project notes) -- SES domain/DKIM
// already verified, production access already approved.
//
// Called from index.js's handleCaptureOrder AFTER markOrderPaid
// succeeds, wrapped in its own try/catch there -- a failed email must
// never undo or fail an already-paid order, same reasoning as
// donate/index.js's receipt generation.

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
const FROM_ADDRESS = process.env.SYSTEM_FROM_EMAIL || 'noreply@sixspurranch.org';

function formatAddress(addr) {
  const line2 = addr.line2 ? `${addr.line2}\n` : '';
  return `${addr.name}\n${addr.line1}\n${line2}${addr.city}, ${addr.state} ${addr.zip}`;
}

function buildItemsText(items) {
  return items
    .map((line) => {
      const variant = line.variantValues ? ` (${Object.values(line.variantValues).join(' / ')})` : '';
      return `  ${line.quantity} x ${line.name}${variant} — $${(line.unitPrice * line.quantity).toFixed(2)}`;
    })
    .join('\n');
}

function buildItemsHtml(items) {
  return items
    .map((line) => {
      const variant = line.variantValues
        ? ` <span style="color:#888888;">(${Object.values(line.variantValues).join(' / ')})</span>`
        : '';
      return `<tr>
        <td style="padding:8px 0;">${line.quantity} &times; ${line.name}${variant}</td>
        <td style="padding:8px 0; text-align:right;">$${(line.unitPrice * line.quantity).toFixed(2)}</td>
      </tr>`;
    })
    .join('');
}

async function sendOrderConfirmation(order) {
  const itemsText = buildItemsText(order.items);
  const itemsHtml = buildItemsHtml(order.items);
  const addressText = formatAddress(order.shippingAddress);

  const textBody = `Thank you for your order from Six Spur Ranch and Rescue!

Order confirmation: ${order.orderId}

ITEMS
${itemsText}

Subtotal: $${order.subtotal.toFixed(2)}
Shipping: $${order.shippingCost.toFixed(2)}
Total: $${order.total.toFixed(2)}

SHIPPING TO
${addressText}

Every purchase supports the animals at Six Spur Ranch and Rescue. Questions about your order? Just reply to this email.
`;

  const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111111;">
  <h2 style="color:#111111;">Thank you for your order!</h2>
  <p style="color:#555555; font-size:13px;">Order confirmation: ${order.orderId}</p>

  <table style="width:100%; border-collapse:collapse; margin:20px 0;">
    ${itemsHtml}
    <tr><td colspan="2" style="border-top:1px solid #E8E2DC; padding-top:8px;"></td></tr>
    <tr><td style="padding:4px 0; color:#555555;">Subtotal</td><td style="text-align:right;">$${order.subtotal.toFixed(2)}</td></tr>
    <tr><td style="padding:4px 0; color:#555555;">Shipping</td><td style="text-align:right;">$${order.shippingCost.toFixed(2)}</td></tr>
    <tr><td style="padding:8px 0; font-weight:bold;">Total</td><td style="text-align:right; font-weight:bold;">$${order.total.toFixed(2)}</td></tr>
  </table>

  <h3 style="color:#111111; font-size:14px;">Shipping To</h3>
  <p style="color:#555555; font-size:13px; white-space:pre-line;">${addressText}</p>

  <p style="color:#888888; font-size:12px; margin-top:24px;">
    Every purchase supports the animals at Six Spur Ranch and Rescue. Questions about your order? Just reply to this email.
  </p>
</div>`;

  await ses.send(new SendEmailCommand({
    Source: FROM_ADDRESS,
    Destination: { ToAddresses: [order.email] },
    Message: {
      Subject: { Data: `Order Confirmation — Six Spur Ranch and Rescue (${order.orderId.slice(0, 8)})` },
      Body: {
        Text: { Data: textBody },
        Html: { Data: htmlBody },
      },
    },
  }));
}

module.exports = { sendOrderConfirmation };
