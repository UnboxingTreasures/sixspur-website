// index.js
// Public, unauthenticated read access to shop_items -- powers the
// homepage ShopPreview section, the /shop catalog page, and /shop/[id]
// product detail pages.
//
//   GET /shop      — list all products (no photos array, just thumbnail -- keeps the list payload small)
//   GET /shop/{id} — one product, full detail (all photos, description, sizes/stock)

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.SHOP_ITEMS_TABLE || 'shop_items';

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
    if (event.routeKey === 'GET /shop') {
      const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
      const items = (result.Items || [])
        .map(({ photos, ...rest }) => rest) // list view doesn't need the full photo pool
        .sort((a, b) => a.name.localeCompare(b.name));
      return respond(200, { items });
    }

    if (event.routeKey === 'GET /shop/{id}') {
      const itemId = event.pathParameters?.id;
      const result = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { itemId } }));
      if (!result.Item) return respond(404, { error: 'Product not found' });
      return respond(200, result.Item);
    }

    return respond(404, { error: `No handler for route: ${event.routeKey}` });
  } catch (err) {
    console.error('Shop request failed:', err);
    return respond(500, { error: 'Something went wrong.' });
  }
};
