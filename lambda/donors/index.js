// index.js
// Donor-facing routes, all protected by the Cognito JWT authorizer at
// the API Gateway level (see 00-cognito-setup.txt step 4). By the time
// any handler here runs, API Gateway has already verified the JWT --
// the donor's identity comes from event.requestContext.authorizer.jwt.claims,
// NEVER from the request body. This is what makes it safe: a donor
// cannot pass a different donorId and see someone else's donations.
//
//   GET   /donor/profile           — get own profile (creates it on first call if missing)
//   PATCH /donor/profile           — update mailing list opt-in / email
//   GET   /donor/donations         — list own donation history
//   GET   /donor/donations/{id}    — get one donation (ownership-checked)

const { getProfile, ensureProfile, updateProfile, listDonationsForDonor, getDonationForDonor } = require('./dynamo');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,PATCH,OPTIONS',
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function getVerifiedDonor(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims?.sub) return null;
  return { donorId: claims.sub, email: claims.email };
}

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, {});
  }

  const donor = getVerifiedDonor(event);
  if (!donor) {
    // Should be unreachable in practice -- the JWT authorizer blocks
    // unauthenticated requests before they ever reach this Lambda. This
    // is a defense-in-depth check, not the primary security boundary.
    return respond(401, { error: 'Not authenticated' });
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
      case 'GET /donor/profile': {
        let profile = await getProfile(donor.donorId);
        if (!profile) profile = await ensureProfile(donor.donorId, donor.email);
        return respond(200, profile);
      }

      case 'PATCH /donor/profile': {
        const updated = await updateProfile(donor.donorId, body);
        return respond(200, updated);
      }

      case 'GET /donor/donations': {
        const donations = await listDonationsForDonor(donor.donorId);
        return respond(200, { donations });
      }

      case 'GET /donor/donations/{id}': {
        const donationId = event.pathParameters?.id;
        const donation = await getDonationForDonor(donor.donorId, donationId);
        if (!donation) return respond(404, { error: 'Donation not found' });
        return respond(200, donation);
      }

      default:
        return respond(404, { error: `No handler for route: ${event.routeKey}` });
    }
  } catch (err) {
    console.error('Donor request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
