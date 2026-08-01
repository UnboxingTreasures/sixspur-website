// pdf.js
// Generates a multi-page PDF summary of a submitted adoption application.
// Auto-paginates as content overflows a page rather than hand-positioning
// every field, since this form has ~30 fields of varying length.

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const PAGE_SIZE = [612, 792]; // US Letter
const MARGIN = 50;
const LINE_HEIGHT = 14;
const LABEL_SIZE = 9;
const VALUE_SIZE = 11;
const SECTION_GAP = 18;
const THUMB_SIZE = 140;
const THUMB_GAP = 12;

async function generateApplicationPdf(data, fencePhotos = []) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage(PAGE_SIZE);
  let y = PAGE_SIZE[1] - MARGIN;
  const contentWidth = PAGE_SIZE[0] - MARGIN * 2;

  function newPageIfNeeded(neededHeight) {
    if (y - neededHeight < MARGIN) {
      page = pdfDoc.addPage(PAGE_SIZE);
      y = PAGE_SIZE[1] - MARGIN;
    }
  }

  function wrapText(text, size, maxWidth, useFont) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let current = '';

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      const width = useFont.widthOfTextAtSize(test, size);
      if (width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [''];
  }

  function forceNewPage() {
    page = pdfDoc.addPage(PAGE_SIZE);
    y = PAGE_SIZE[1] - MARGIN;
  }

  function drawHeading(text) {
    y -= SECTION_GAP;
    page.drawText(text, { x: MARGIN, y, size: 14, font: boldFont, color: rgb(0.15, 0.15, 0.15) });
    y -= 4;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_SIZE[0] - MARGIN, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= LINE_HEIGHT + 4;
  }

  function drawField(label, value) {
    if (value === undefined || value === null || value === '') return;
    const lines = wrapText(value, VALUE_SIZE, contentWidth, font);
    const neededHeight = LINE_HEIGHT + lines.length * LINE_HEIGHT + 6;
    newPageIfNeeded(neededHeight);

    page.drawText(label.toUpperCase(), { x: MARGIN, y, size: LABEL_SIZE, font: boldFont, color: rgb(0.55, 0.35, 0.15) });
    y -= LINE_HEIGHT;

    for (const line of lines) {
      newPageIfNeeded(LINE_HEIGHT);
      page.drawText(line, { x: MARGIN, y, size: VALUE_SIZE, font, color: rgb(0.1, 0.1, 0.1) });
      y -= LINE_HEIGHT;
    }
    y -= 6;
  }

  async function drawFencePhotoThumbnails(photos) {
    if (!photos || photos.length === 0) {
      drawField('Fence Photos Attached', 'None');
      return;
    }

    // Reserve room for the label AND at least one full row of thumbnails
    // together — otherwise the label can render at the bottom of a page
    // while the actual images get pushed to the next one.
    newPageIfNeeded(LINE_HEIGHT * 2 + THUMB_SIZE + THUMB_GAP);

    page.drawText('FENCE / ENCLOSURE PHOTOS', {
      x: MARGIN,
      y,
      size: LABEL_SIZE,
      font: boldFont,
      color: rgb(0.55, 0.35, 0.15),
    });
    y -= LINE_HEIGHT + 4;

    const perRow = Math.max(1, Math.floor(contentWidth / (THUMB_SIZE + THUMB_GAP)));
    let col = 0;
    const failedPhotos = [];

    for (const photo of photos) {
      newPageIfNeeded(THUMB_SIZE + 10);

      try {
        let embedded;
        const isPng = photo.contentType.includes('png') || /\.png$/i.test(photo.key);
        if (isPng) {
          embedded = await pdfDoc.embedPng(photo.bytes);
        } else {
          // Default to JPEG for jpg/jpeg and unlabeled content types — most
          // phone camera uploads land here. HEIC/HEIF isn't supported by
          // pdf-lib and throws, caught below with a graceful fallback note.
          embedded = await pdfDoc.embedJpg(photo.bytes);
        }

        const scale = Math.min(THUMB_SIZE / embedded.width, THUMB_SIZE / embedded.height);
        const w = embedded.width * scale;
        const h = embedded.height * scale;
        const x = MARGIN + col * (THUMB_SIZE + THUMB_GAP);

        page.drawImage(embedded, { x, y: y - h, width: w, height: h });

        col += 1;
        if (col >= perRow) {
          col = 0;
          y -= THUMB_SIZE + THUMB_GAP;
        }
      } catch (err) {
        failedPhotos.push(photo.key.split('/').pop());
      }
    }

    if (col !== 0) y -= THUMB_SIZE + THUMB_GAP;
    y -= 6;

    if (failedPhotos.length > 0) {
      drawField(
        'Note',
        `${failedPhotos.length} photo(s) could not be embedded (unsupported format, e.g. HEIC) — view via the admin inbox link instead.`
      );
    }
  }

  async function drawWatermarks() {
    const logoPath = path.join(__dirname, 'assets', 'logo-watermark.png');
    let logoImage = null;

    console.log(`[watermark] __dirname = ${__dirname}`);
    console.log(`[watermark] looking for logo at: ${logoPath}`);
    console.log(`[watermark] file exists? ${fs.existsSync(logoPath)}`);

    try {
      console.log(`[watermark] __dirname contents:`, fs.readdirSync(__dirname));
      const assetsPath = path.join(__dirname, 'assets');
      if (fs.existsSync(assetsPath)) {
        console.log(`[watermark] assets/ contents:`, fs.readdirSync(assetsPath));
      } else {
        console.log(`[watermark] assets/ directory does not exist at ${assetsPath}`);
      }
    } catch (err) {
      console.error('[watermark] Error listing directory contents:', err);
    }

    if (fs.existsSync(logoPath)) {
      try {
        const logoBytes = fs.readFileSync(logoPath);
        logoImage = await pdfDoc.embedPng(logoBytes);
        console.log('[watermark] logo embedded successfully');
      } catch (err) {
        console.error('[watermark] Could not embed watermark logo, continuing without it:', err);
      }
    } else {
      console.log('[watermark] logo file not found, skipping image (text watermark will still draw)');
    }

    const footerText = 'Six Spur Ranch and Rescue';
    const footerSize = 9;
    const textY = 18; // baseline for the text, near the bottom margin
    const logoTextGap = 4;
    const logoWidth = logoImage ? 24 : 0;

    for (const p of pdfDoc.getPages()) {
      const { width } = p.getSize();

      const textWidth = boldFont.widthOfTextAtSize(footerText, footerSize);

      if (logoImage) {
        const scale = logoWidth / logoImage.width;
        const logoHeight = logoImage.height * scale;
        const logoX = (width - logoWidth) / 2; // centered horizontally
        const logoY = textY + footerSize + logoTextGap; // sits above the text

        p.drawImage(logoImage, {
          x: logoX,
          y: logoY,
          width: logoWidth,
          height: logoHeight,
          opacity: 0.35,
        });
      }

      p.drawText(footerText, {
        x: (width - textWidth) / 2, // centered horizontally
        y: textY,
        size: footerSize,
        font: boldFont,
        color: rgb(0.6, 0.5, 0.4),
        opacity: 0.4,
      });
    }
  }

  // Title
  page.drawText('Six Spur Ranch and Rescue', { x: MARGIN, y, size: 18, font: boldFont, color: rgb(0.91, 0.48, 0.18) });
  y -= 22;
  page.drawText('Adoption Application', { x: MARGIN, y, size: 13, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 18;
  page.drawText(`Submitted: ${new Date().toLocaleString('en-US')}`, { x: MARGIN, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
  y -= 10;

  drawHeading('Contact Information');
  drawField('Name', `${data.firstName} ${data.lastName}`);
  drawField('Spouse / Partner / Roommate', data.partner);
  drawField('Address', `${data.street}${data.apt ? `, ${data.apt}` : ''}, ${data.city}, ${data.state} ${data.zip}${data.county ? ` (${data.county} County)` : ''}`);
  drawField('Primary Phone', `${data.primaryPhone} (${data.primaryPhoneType})`);
  drawField('Secondary Phone', data.secondaryPhone ? `${data.secondaryPhone} (${data.secondaryPhoneType})` : '');
  drawField('Primary Email', data.primaryEmail);
  drawField('Secondary Email', data.secondaryEmail);
  drawField('Interested In', data.interestedIn);

  forceNewPage();
  drawHeading('Household & Care');
  drawField('Adopt or Foster', (data.adoptOrFoster || []).join(', '));
  drawField('Employment', data.employment);
  drawField('Household Members', data.household);
  drawField('Children Ages', data.childrenAges);
  drawField('Other Pets', (data.otherPets || []).join('; '));
  drawField('Other Pets — Details', data.otherPetsDetail);
  drawField('Topics to Discuss', (data.topics || []).join(', '));

  forceNewPage();
  drawHeading('Animal Care Plan');
  drawField("Animal's Role", data.petUse);
  drawField('Livestock/Farm Animal Experience', data.livestockExp);
  drawField('Where Animal Will Be Kept', data.keptAt);
  drawField('Fenced?', data.yardFenced);
  await drawFencePhotoThumbnails(fencePhotos);
  drawField('Agrees to Site Visit', data.siteVisit);
  drawField('Daily Care Routine', data.barnRoutine);
  drawField('Reliable Transportation to Vet', data.reliableTransport);
  drawField('Care When Away', data.careWhenAway);
  drawField('Veterinarian', data.vet);
  drawField('References', data.references);
  drawField('Additional Notes', data.additional);

  forceNewPage();
  drawHeading('Agreement');
  drawField('Agreed to Terms and Conditions', data.agreedToTerms ? 'Yes' : 'No');
  drawField('Agreed to Return Policy', data.agreedToReturn ? 'Yes' : 'No');
  drawField('Signature', data.signature);

  await drawWatermarks();

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

module.exports = { generateApplicationPdf };
