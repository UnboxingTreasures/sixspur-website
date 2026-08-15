// receipt.js
// Identical to lambda/donate/receipt.js -- copied here per this
// project's per-Lambda file pattern (no Lambda Layer). Handles PDF
// generation, S3 upload, and SES email for a single donation record,
// regardless of whether it came from a one-time capture or a recurring
// webhook charge -- generateAndSendReceipt() only cares about the shape
// of the donation object (donationId, donorEmail, amount, type, etc.),
// not which flow produced it.

const PDFDocument = require('pdfkit');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { randomUUID } = require('crypto');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

const BUCKET = process.env.ASSETS_BUCKET || 'sixspurranch-assets';
const CDN_BASE = process.env.CDN_BASE || 'https://d1s8s7aw8vf5zu.cloudfront.net';
const FROM_ADDRESS = process.env.SES_FROM_ADDRESS || 'noreply@sixspurranch.org';

const ORG_LEGAL_NAME = 'Six Spur Ranch Company';
const ORG_EIN = '41-4123317';
const ORG_ADDRESS = 'PO Box 333, Nash, TX 75569';

function formatCurrency(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

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
    doc.moveDown(1.5);

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
