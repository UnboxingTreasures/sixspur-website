// index.js
// Public, unauthenticated read access to staff_members -- powers the
// homepage Team section and the /about page's team list.
//
//   GET /staff — list all staff members

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.STAFF_TABLE || 'staff_members';

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
    if (event.routeKey === 'GET /staff') {
      const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
      const staff = (result.Items || []).sort((a, b) => a.name.localeCompare(b.name));
      return respond(200, { staff });
    }
    return respond(404, { error: `No handler for route: ${event.routeKey}` });
  } catch (err) {
    console.error('Staff request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
