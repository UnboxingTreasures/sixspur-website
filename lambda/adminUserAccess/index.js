// index.js
// Admin-only routes for granting/revoking admin access.
//   GET    /admin/user-access          — list current admins
//   POST   /admin/user-access          — grant admin access by email
//   DELETE /admin/user-access/{id}     — revoke admin access (super-admin only, see below)
//
// Self-referential: only an existing admin can grant/revoke admin
// access, checked via requireAdmin() on every route -- same shared
// check every other admin Lambda uses.
//
// Revoking admin access is further restricted to the super-admin
// email(s) below, regardless of who else has isAdmin=true. Any admin
// can still GRANT access, but only a super-admin can pull it back.
// This is deliberately a hardcoded allowlist rather than a "role" field
// on the donor record. To add or change a super-admin, edit this set
// AND the matching set in src/app/(admin)/admin/user-access/page.tsx,
// then redeploy this Lambda (./deploy.sh) and push the frontend.

const { requireAdmin } = require('./adminAuth');
const { listAdmins, grantAdmin, revokeAdmin } = require('./dynamo');

const SUPER_ADMIN_EMAILS = new Set(['sixspurrescue@gmail.com']);

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
      case 'GET /admin/user-access': {
        const admins = await listAdmins();
        return respond(200, { admins });
      }

      case 'POST /admin/user-access': {
        try {
          const granted = await grantAdmin(body.email);
          return respond(200, granted);
        } catch (err) {
          return respond(400, { error: err.message });
        }
      }

      case 'DELETE /admin/user-access/{id}': {
        if (!SUPER_ADMIN_EMAILS.has((auth.email || '').trim().toLowerCase())) {
          return respond(403, { error: 'Only the Six Spur account can revoke admin access.' });
        }
        try {
          const revoked = await revokeAdmin(event.pathParameters?.id, auth.donorId);
          if (!revoked) return respond(404, { error: 'Admin not found' });
          return respond(200, revoked);
        } catch (err) {
          return respond(400, { error: err.message });
        }
      }

      default:
        return respond(404, { error: `No handler for route: ${event.routeKey}` });
    }
  } catch (err) {
    console.error('User access request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
