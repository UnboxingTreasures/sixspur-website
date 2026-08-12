// index.js
// Public, unauthenticated read access to adoptable_animals -- will power
// a public /adopt listing page once that's built (not part of today's
// scope, which is just the admin add/edit/delete capability).
//
//   GET /adoptable-animals      — list all (no photos array, just thumbnail)
//   GET /adoptable-animals/{id} — one animal, full detail (all photos, descriptors)

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.ADOPTABLE_ANIMALS_TABLE || 'adoptable_animals';

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
        .map(({ photos, ...rest }) => rest)
        .sort((a, b) => a.name.localeCompare(b.name));
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
