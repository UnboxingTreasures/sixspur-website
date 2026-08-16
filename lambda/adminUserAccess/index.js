// index.js
// Admin-only routes for granting/revoking admin access.
//   GET    /admin/user-access          — list current admins
//   POST   /admin/user-access          — grant admin access by email
//   DELETE /admin/user-access/{id}     — revoke admin access (super-admins only, see below)
//
// Self-referential: only an existing admin can grant/revoke admin
// access, checked via requireAdmin() on every route -- same shared
// check every other admin Lambda uses.
//
// UPDATED -- revoking admin access is now further restricted to just
// the two super-admin emails below, regardless of who else has
// isAdmin=true. Any admin can still GRANT access (unchanged), but only
// these two can pull it back from someone. This is deliberately a
// hardcoded allowlist rather than a new "role" field on the donor
// record -- it's two specific people, not a tier of access that's
// expected to grow, so a database-driven roles system would be more
// machinery than the actual requirement calls for.

const { requireAdmin } = require('./adminAuth');
const { listAdmins, grantAdmin, revokeAdmin } = require('./dynamo');

const SUPER_ADMIN_EMAILS = new Set(['sixspurrescue@gmail.com', 'jaylefler1974@gmail.com']);

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
          return respond(403, { error: 'Only Six Spur or Jay can revoke admin access.' });
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
