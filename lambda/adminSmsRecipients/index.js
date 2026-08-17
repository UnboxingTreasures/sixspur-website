// index.js
// Admin-only Lambda backing the "Text Alert Recipients" section on the
// User Access page. Lets an admin add a phone number, walk it through
// SNS's sandbox OTP verification, and remove numbers -- all without
// touching the AWS console.
//
// A verified number here starts receiving texts IMMEDIATELY -- the 5
// notification Lambdas (donate, orders, adoptionApplication,
// contactForm, processIncomingEmail) read the sms_recipients table's
// status field directly at invocation time (see getRecipients.js in
// each), rather than a static env var. This handler is what keeps that
// status field in sync with SNS's own verification state.

const { requireAdmin } = require('./adminAuth');
const { putRecipient, updateStatus, deleteRecipient, listRecipients } = require('./dynamo');
const { addSandboxNumber, verifySandboxNumber, listSandboxNumbers, deleteSandboxNumber } = require('./sns');

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
    // GET /admin/sms-recipients -- our table's status field is what the
    // 5 notification Lambdas actually read, so it's shown as primary.
    // Live SNS status is included too, as a cross-check in case
    // something was changed manually in the AWS console outside this UI.
    if (method === 'GET' && path.endsWith('/admin/sms-recipients')) {
      const [labeled, sandboxNumbers] = await Promise.all([listRecipients(), listSandboxNumbers()]);

      const liveSnsStatusByNumber = new Map(sandboxNumbers.map((n) => [n.PhoneNumber, n.Status]));

      const recipients = labeled.map((r) => ({
        phoneNumber: r.phoneNumber,
        label: r.label || null,
        addedBy: r.addedBy || null,
        addedAt: r.addedAt || null,
        status: r.status || 'Unknown',
        liveSnsStatus: liveSnsStatusByNumber.get(r.phoneNumber) || 'Unknown',
      }));

      return respond(200, { recipients });
    }

    // POST /admin/sms-recipients -- add a number, triggers SNS OTP text
    if (method === 'POST' && path.endsWith('/admin/sms-recipients')) {
      const phoneNumber = (body.phoneNumber || '').trim();
      const label = (body.label || '').trim();
      if (!PHONE_RE.test(phoneNumber)) {
        return respond(400, { error: 'Phone number must be in E.164 format, e.g. +18135551234' });
      }
      if (!label) {
        return respond(400, { error: 'Label is required (whose number this is)' });
      }

      await addSandboxNumber(phoneNumber);
      const recipient = await putRecipient({ phoneNumber, label, addedBy: auth.donorId });

      return respond(201, { recipient, message: 'Verification code sent via text.' });
    }

    // POST /admin/sms-recipients/verify -- submit the OTP code. On
    // success, marks status Verified in our own table -- this is the
    // write that makes the number start receiving real alerts.
    if (method === 'POST' && path.endsWith('/admin/sms-recipients/verify')) {
      const phoneNumber = (body.phoneNumber || '').trim();
      const code = (body.code || '').trim();
      if (!PHONE_RE.test(phoneNumber) || !code) {
        return respond(400, { error: 'phoneNumber and code are required' });
      }

      await verifySandboxNumber(phoneNumber, code);
      await updateStatus(phoneNumber, 'Verified');
      return respond(200, { message: 'Number verified. It will now receive alerts.' });
    }

    // POST /admin/sms-recipients/remove -- delete from SNS and our table
    if (method === 'POST' && path.endsWith('/admin/sms-recipients/remove')) {
      const phoneNumber = (body.phoneNumber || '').trim();
      if (!PHONE_RE.test(phoneNumber)) {
        return respond(400, { error: 'Valid phoneNumber is required' });
      }

      await Promise.allSettled([deleteSandboxNumber(phoneNumber), deleteRecipient(phoneNumber)]);
      return respond(200, { message: 'Number removed.' });
    }

    return respond(404, { error: 'Not found' });
  } catch (err) {
    console.error('adminSmsRecipients error:', err);
    const message = err?.message || 'Internal error';
    return respond(500, { error: message });
  }
};
