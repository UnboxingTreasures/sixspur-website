// index.js
// Public, unauthenticated read access to farm_animals -- powers the
// homepage Farm Family cards, the "meet them all" index page, and each
// species' gallery page. No admin/write operations here; those live in
// the separate adminFarmAnimals Lambda.
//
//   GET /farm-animals        — list all types (id, name, description, thumbnailUrl)
//                               -- deliberately omits `photos` to keep the list
//                               response small; the homepage/index pages only
//                               need one image per card, not the full gallery.
//   GET /farm-animals/{id}   — one type's full detail, including all photos

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.FARM_ANIMALS_TABLE || 'farm_animals';

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

async function handleList() {
  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  const animals = (result.Items || [])
    .map(({ animalId, name, description, thumbnailUrl }) => ({ animalId, name, description, thumbnailUrl }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return respond(200, { animals });
}

async function handleDetail(animalId) {
  const result = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { animalId } }));
  if (!result.Item) return respond(404, { error: 'Animal type not found' });
  return respond(200, result.Item);
}

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, {});
  }

  const animalId = event.pathParameters?.id;

  try {
    if (event.routeKey === 'GET /farm-animals') {
      return await handleList();
    }
    if (event.routeKey === 'GET /farm-animals/{id}') {
      return await handleDetail(animalId);
    }
    return respond(404, { error: `No handler for route: ${event.routeKey}` });
  } catch (err) {
    console.error('Farm animals request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
