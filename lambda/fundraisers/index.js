// index.js
// Public, unauthenticated read access to fundraisers.
//   GET /fundraisers/active — the current active fundraiser (or null), with live-calculated raisedAmount

const { getActiveFundraiser } = require('./dynamo');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
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

  try {
    if (event.routeKey === 'GET /fundraisers/active') {
      const fundraiser = await getActiveFundraiser();
      return respond(200, { fundraiser });
    }

    return respond(404, { error: `No handler for route: ${event.routeKey}` });
  } catch (err) {
    console.error('Fundraisers request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
