// receipt.js
// Shared module for generating a 501(c)(3) donation tax receipt (PDF) and
// emailing it to the donor via SES. Not its own Lambda -- gets copied
// into whichever Lambda needs to trigger a receipt (currently
// lambda/donate and lambda/donate-recurring-webhook -- keep both copies
// in sync when editing this file; manual entry's copy in adminDonations
// was removed).
//
// PER-CHARGE receipt only. The annual summary letter (scoped Aug 11,
// see project notes Section 13) is separate, not-yet-built work -- a
// batch/scheduled job around year-end, not triggered per-donation like
// this is.

const PDFDocument = require('pdfkit');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { randomUUID } = require('crypto');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

const BUCKET = process.env.ASSETS_BUCKET || 'sixspurranch-assets';
const CDN_BASE = process.env.CDN_BASE || 'https://d1s8s7aw8vf5zu.cloudfront.net';
const FROM_ADDRESS = process.env.SES_FROM_ADDRESS || 'noreply@sixspurranch.org';

// Legal entity name for tax documents -- "Six Spur Ranch Company" is used
// ONLY in legal/official contexts per established project convention;
// "Six Spur Ranch and Rescue" is the everyday public-facing name used
// everywhere else. A tax receipt is exactly the legal-context case.
const ORG_LEGAL_NAME = 'Six Spur Ranch Company';
const ORG_EIN = '41-4123317';
const ORG_ADDRESS = 'PO Box 333, Nash, TX 75569'; // confirmed Aug 12 -- Richard's PO Box, not the county line physical address

function formatCurrency(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Builds the PDF as an in-memory buffer. Content follows standard IRS
 * substantiation requirements for a 501(c)(3) cash contribution
 * acknowledgment: org name + EIN, donor name, date, amount, and an
 * explicit statement on whether goods/services were exchanged (required
 * language whenever anything was given in return; "no goods or services"
 * is the standard line for a pure donation, which is the only case this
 * function currently handles -- see the goodsOrServicesDescription note
 * below for what a future gift-with-benefit donation would need).
 *
 * UPDATED same session: adds a Campaign line when the donation was made
 * toward a specific fundraiser -- Type still correctly says "One-time
 * contribution" (that's a true, separate fact about payment mechanics,
 * one-time vs recurring), the campaign name is additional information,
 * not a replacement for it.
 *
 * UPDATED (Session 20): adds the PayPal transaction ID, when present on
 * the donation record. Not an IRS requirement for the receipt itself,
 * but gives the donor/admin a direct reference to cross-check this
 * exact charge against PayPal's own transaction history -- same
 * reasoning as adding it to the donor account page's history list.
 * Guarded with an if-check since older donation records predating this
 * field won't have it.
 */
function buildReceiptPdf(donation) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).font('Helvetica-Bold').text(ORG_LEGAL_NAME, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(ORG_ADDRESS, { align: 'center' });
    doc.text(`EIN: ${ORG_EIN}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(16).font('Helvetica-Bold').text('Official Donation Receipt', { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(11).font('Helvetica');
    doc.text(`Date of Contribution: ${formatDate(donation.createdAt)}`);
    doc.text(`Donor: ${donation.donorEmail}`);
    doc.text(`Amount: ${formatCurrency(donation.amount)}`);
    doc.text(`Type: ${donation.type === 'recurring' ? 'Recurring (monthly) contribution' : 'One-time contribution'}`);
    if (donation.campaignTitle) {
      doc.text(`Campaign: ${donation.campaignTitle}`);
    }
    if (donation.paypalTransactionId) {
      doc.text(`PayPal Transaction ID: ${donation.paypalTransactionId}`);
    }
    doc.moveDown(1.5);

    // Standard IRS-required statement. NOTE: this assumes no goods or
    // services were provided in exchange, which is the only case this
    // function handles right now. If Six Spur ever offers something in
    // return for a donation (e.g. a gala ticket, a thank-you gift above
    // token value), this paragraph needs to change to describe and
    // value what was provided instead -- flag that scenario if it comes
    // up, don't reuse this wording as-is.
    doc.text(
      'No goods or services were provided in exchange for this contribution. ' +
      `${ORG_LEGAL_NAME} is a tax-exempt organization under Section 501(c)(3) of the Internal Revenue Code. ` +
      'This receipt is provided for your tax records. Please consult your tax advisor regarding the deductibility of this contribution.'
    );
    doc.moveDown(2);

    doc.fontSize(10).fillColor('#666666').text('Thank you for supporting the animals at Six Spur Ranch and Rescue.', { align: 'center' });

    doc.end();
  });
}

async function uploadReceiptPdf(donationId, pdfBuffer) {
  const key = `documents/receipts/${donationId}-${randomUUID()}.pdf`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
  }));
  return `${CDN_BASE}/${key}`;
}

async function emailReceipt(donation, receiptUrl) {
  const subject = `Your Six Spur Ranch donation receipt — ${formatCurrency(donation.amount)}`;
  const bodyText =
    `Thank you for your generous ${formatCurrency(donation.amount)} donation to Six Spur Ranch and Rescue` +
    `${donation.campaignTitle ? ` toward ${donation.campaignTitle}` : ''}.\n\n` +
    `Your official tax receipt is attached/available here: ${receiptUrl}\n\n` +
    `You can also view your full donation history anytime by logging into your account at sixspurranch.org/account.\n\n` +
    `Thank you for supporting the animals at Six Spur Ranch and Rescue.`;

  await ses.send(new SendEmailCommand({
    Source: FROM_ADDRESS,
    Destination: { ToAddresses: [donation.donorEmail] },
    Message: {
      Subject: { Data: subject },
      Body: { Text: { Data: bodyText } },
    },
  }));
}

/**
 * Main entry point -- call this after a donation record is created
 * (PayPal capture success). Returns the receipt URL so the caller can
 * store it on the donation record. Does NOT throw on email failure -- a
 * failed receipt email shouldn't un-record a successful donation, but
 * it DOES throw on PDF/S3 failure, since a donation with no receipt at
 * all is a real problem worth surfacing loudly rather than silently
 * swallowing.
 */
async function generateAndSendReceipt(donation) {
  const pdfBuffer = await buildReceiptPdf(donation);
  const receiptUrl = await uploadReceiptPdf(donation.donationId, pdfBuffer);

  try {
    await emailReceipt(donation, receiptUrl);
  } catch (err) {
    console.error(`Receipt PDF generated (${receiptUrl}) but email failed for donation ${donation.donationId}:`, err);
  }

  return receiptUrl;
}

module.exports = { generateAndSendReceipt };
