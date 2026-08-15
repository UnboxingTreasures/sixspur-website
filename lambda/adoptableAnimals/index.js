// index.js
// Public, unauthenticated read access to adoptable_animals.
//
//   GET /adoptable-animals                 — list all AVAILABLE animals (adoptedAt excluded)
//   GET /adoptable-animals/{id}             — one animal, full detail (all photos, descriptors) -- returned even if adopted, so an old bookmark/shared link still resolves; the frontend is responsible for not offering "Apply to Adopt" once adoptedAt is set
//   GET /adoptable-animals/recently-adopted — animals adopted within the last 6 months (added Session 18)
//
// RECENTLY ADOPTED (Session 18): adoptedAt gets set by adminAdoptions when
// an application is approved (see lambda/adminAdoptions/dynamo.js), not by
// anything in this Lambda. This file only READS that field to decide what
// counts as "available" vs. "recently adopted". Per the confirmed spec: an
// adopted animal disappears IMMEDIATELY from the main listing (no grace
// period), and shows in Recently Adopted for exactly 6 months from
// adoptedAt, then drops off entirely (though the record and its
// adoptedAt timestamp are never deleted -- just no longer surfaced
// anywhere public once past that window).

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.ADOPTABLE_ANIMALS_TABLE || 'adoptable_animals';
const RECENTLY_ADOPTED_MONTHS = 6;

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
    if (event.routeKey === 'GET /adoptable-animals') {
      const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
      const animals = (result.Items || [])
        .filter((a) => !a.adoptedAt) // adopted animals never appear in the main listing
        .map(({ photos, ...rest }) => rest)
        .sort((a, b) => a.name.localeCompare(b.name));
      return respond(200, { animals });
    }

    if (event.routeKey === 'GET /adoptable-animals/recently-adopted') {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - RECENTLY_ADOPTED_MONTHS);

      const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
      const animals = (result.Items || [])
        .filter((a) => a.adoptedAt && new Date(a.adoptedAt) >= cutoff)
        .map(({ photos, ...rest }) => rest)
        .sort((a, b) => new Date(b.adoptedAt) - new Date(a.adoptedAt)); // most recently adopted first
      return respond(200, { animals });
    }

    if (event.routeKey === 'GET /adoptable-animals/{id}') {
      const animalId = event.pathParameters?.id;
      const result = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { animalId } }));
      if (!result.Item) return respond(404, { error: 'Animal not found' });
      return respond(200, result.Item);
    }

    return respond(404, { error: `No handler for route: ${event.routeKey}` });
  } catch (err) {
    console.error('Adoptable animals request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
