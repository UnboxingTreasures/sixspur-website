// index.js
// Admin routes for managing fundraisers.
//   GET    /admin/fundraisers            — list all, with live raised-so-far totals
//   GET    /admin/fundraisers/{id}       — one fundraiser
//   POST   /admin/fundraisers            — create (starts as draft)
//   PATCH  /admin/fundraisers/{id}       — edit title/description/goal/closing date
//   POST   /admin/fundraisers/{id}/begin — make this the active fundraiser (stops any other active one)
//   POST   /admin/fundraisers/{id}/stop  — stop this fundraiser
// No DELETE -- financial-adjacent records, same reasoning as donations.
//
// AUTH: every route here requires a verified JWT (via the same
// authorizer protecting /donor/* and /donate/*) AND isAdmin=true on
// the donor record -- see requireAdmin() in adminAuth.js.

const { listAll, getById, createFundraiser, updateFundraiser, beginFundraiser, stopFundraiser } = require('./dynamo');
const { requireAdmin } = require('./adminAuth');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
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

  const fundraiserId = event.pathParameters?.id;
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
      case 'GET /admin/fundraisers': {
        const fundraisers = await listAll();
        return respond(200, { fundraisers });
      }
      case 'GET /admin/fundraisers/{id}': {
        const fundraiser = await getById(fundraiserId);
        if (!fundraiser) return respond(404, { error: 'Fundraiser not found' });
        return respond(200, fundraiser);
      }
      case 'POST /admin/fundraisers': {
        try {
          const created = await createFundraiser(body);
          return respond(201, created);
        } catch (err) {
          return respond(400, { error: err.message });
        }
      }
      case 'PATCH /admin/fundraisers/{id}': {
        try {
          const updated = await updateFundraiser(fundraiserId, body);
          if (!updated) return respond(404, { error: 'Fundraiser not found' });
          return respond(200, updated);
        } catch (err) {
          return respond(400, { error: err.message });
        }
      }
      case 'POST /admin/fundraisers/{id}/begin': {
        const started = await beginFundraiser(fundraiserId);
        if (!started) return respond(404, { error: 'Fundraiser not found' });
        return respond(200, started);
      }
      case 'POST /admin/fundraisers/{id}/stop': {
        const stopped = await stopFundraiser(fundraiserId);
        if (!stopped) return respond(404, { error: 'Fundraiser not found' });
        return respond(200, stopped);
      }
      default:
        return respond(404, { error: `No handler for route: ${event.routeKey}` });
    }
  } catch (err) {
    console.error('Admin fundraisers request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
