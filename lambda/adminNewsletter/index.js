// index.js
// Admin routes for the mailing list compose/send flow:
//   GET  /admin/newsletter/subscribers    — active subscriber count
//   POST /admin/newsletter/photo/presign  — presigned upload URL for the optional blast image
//   POST /admin/newsletter/send           — compose and send a blast to every active subscriber
//
// AUTH: every route here requires a verified JWT (via the same
// authorizer protecting /donor/* and /donate/*) AND isAdmin=true on
// the donor record -- see requireAdmin() in adminAuth.js.

const { listActiveSubscribers } = require('./dynamo');
const { createPresignedUploadUrl, deletePhotoSafely } = require('./s3');
const { sendNewsletterEmail } = require('./ses');
const { requireAdmin } = require('./adminAuth');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, {});
  }

  const auth = await requireAdmin(event);
  if (!auth.authorized) {
    return respond(auth.statusCode, { error: auth.error });
  }

  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return respond(400, { error: 'Invalid JSON body' });
    }
  }

  try {
    switch (event.routeKey) {
      case 'GET /admin/newsletter/subscribers': {
        const subscribers = await listActiveSubscribers();
        return respond(200, { count: subscribers.length });
      }

      case 'POST /admin/newsletter/photo/presign': {
        const fileName = body.fileName;
        if (!fileName) return respond(400, { error: 'fileName is required' });
        const { uploadUrl, cdnUrl } = await createPresignedUploadUrl(fileName);
        return respond(200, { uploadUrl, cdnUrl });
      }

      case 'POST /admin/newsletter/send': {
        const { subject, description, imageUrl } = body;
        if (!subject || !subject.trim()) return respond(400, { error: 'subject is required' });
        if (!description || !description.trim()) return respond(400, { error: 'description is required' });

        const subscribers = await listActiveSubscribers();
        if (subscribers.length === 0) {
          return respond(200, { sent: 0, failed: 0, total: 0, message: 'No active subscribers to send to.' });
        }

        let sent = 0;
        const failures = [];

        // Sequential, not Promise.all -- see the scaling note in ses.js.
        // One bad address is logged and skipped, doesn't stop the rest
        // of the list from receiving the blast.
        for (const subscriber of subscribers) {
          try {
            await sendNewsletterEmail({
              toEmail: subscriber.email,
              unsubscribeToken: subscriber.unsubscribeToken,
              subject,
              description,
              imageUrl,
            });
            sent += 1;
          } catch (err) {
            console.error(`Failed to send newsletter to ${subscriber.email}:`, err);
            failures.push(subscriber.email);
          }
        }

        return respond(200, {
          sent,
          failed: failures.length,
          total: subscribers.length,
          failedEmails: failures,
        });
      }

      case 'DELETE /admin/newsletter/photo': {
        if (!body.imageUrl) return respond(400, { error: 'imageUrl is required' });
        await deletePhotoSafely(body.imageUrl);
        return respond(200, { success: true });
      }

      default:
        return respond(404, { error: `No handler for route: ${event.routeKey}` });
    }
  } catch (err) {
    console.error('Admin newsletter request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
