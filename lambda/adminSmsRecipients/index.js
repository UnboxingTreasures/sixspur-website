// index.js
// Admin-only Lambda backing the "Text Alert Recipients" section on the
// User Access page. Lets an admin add a phone number (immediately
// active) or remove one -- all without touching the AWS console.
//
// A recipient here starts receiving texts IMMEDIATELY on add -- the 5
// notification Lambdas (donate, orders, adoptionApplication,
// contactForm, processIncomingEmail) read the sms_recipients table's
// status field directly at invocation time (see getRecipients.js in
// each), rather than a static env var.
//
// NOTE: this used to walk each number through SNS's SMS Sandbox OTP
// verification flow before marking it Verified. Now that the account
// is out of SNS sandbox, that step is unnecessary -- AWS allows
// sending to any number without per-number verification, so recipients
// are marked Verified on add and there's no separate /verify route.

const { requireAdmin } = require('./adminAuth');
const { putRecipient, deleteRecipient, listRecipients } = require('./dynamo');

const PHONE_RE = /^\+[1-9]\d{6,14}$/;

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const auth = await requireAdmin(event);
  if (!auth.authorized) {
    return respond(auth.statusCode, { error: auth.error });
  }

  const method = event.requestContext?.http?.method;
  const path = event.rawPath || '';
  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  try {
    // GET /admin/sms-recipients
    if (method === 'GET' && path.endsWith('/admin/sms-recipients')) {
      const recipients = (await listRecipients()).map((r) => ({
        phoneNumber: r.phoneNumber,
        label: r.label || null,
        addedBy: r.addedBy || null,
        addedAt: r.addedAt || null,
        status: r.status || 'Verified',
      }));

      return respond(200, { recipients });
    }

    // POST /admin/sms-recipients -- adds a number, active immediately
    if (method === 'POST' && path.endsWith('/admin/sms-recipients')) {
      const phoneNumber = (body.phoneNumber || '').trim();
      const label = (body.label || '').trim();
      if (!PHONE_RE.test(phoneNumber)) {
        return respond(400, { error: 'Phone number must be in E.164 format, e.g. +18135551234' });
      }
      if (!label) {
        return respond(400, { error: 'Label is required (whose number this is)' });
      }

      const recipient = await putRecipient({ phoneNumber, label, addedBy: auth.donorId });

      return respond(201, { recipient, message: 'Number added. It will now receive alerts.' });
    }

    // POST /admin/sms-recipients/remove
    if (method === 'POST' && path.endsWith('/admin/sms-recipients/remove')) {
      const phoneNumber = (body.phoneNumber || '').trim();
      if (!PHONE_RE.test(phoneNumber)) {
        return respond(400, { error: 'Valid phoneNumber is required' });
      }

      await deleteRecipient(phoneNumber);
      return respond(200, { message: 'Number removed.' });
    }

    return respond(404, { error: 'Not found' });
  } catch (err) {
    console.error('adminSmsRecipients error:', err);
    const message = err?.message || 'Internal error';
    return respond(500, { error: message });
  }
};
