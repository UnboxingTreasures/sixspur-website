// migrate-shop.js
// ONE-TIME script: seeds the brand-new shop_items table from the current
// shopItems.json content. None of the 4 existing products (hats, tumbler)
// have sizes -- hasSizes: false, single stock count. description is a NEW
// field that didn't exist in the JSON, left blank for Richard to fill in
// via the admin panel.
//
// Run once, locally: node migrate-shop.js
// Safe to re-run -- PutItem overwrites cleanly rather than duplicating.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'shop_items';
const CDN = 'https://d1s8s7aw8vf5zu.cloudfront.net';

const ITEMS = [
  {
    itemId: 'hat-black-grey',
    name: '6S Trucker Hat — Black/Grey',
    description: '',
    price: 24.95,
    category: 'hats',
    photos: [`${CDN}/images/shop/hat-black-grey.jpg`],
    thumbnailUrl: `${CDN}/images/shop/hat-black-grey.jpg`,
    hasSizes: false,
    stock: 0,
  },
  {
    itemId: 'hat-brown-tan',
    name: '6S Trucker Hat — Brown/Tan',
    description: '',
    price: 24.95,
    category: 'hats',
    photos: [`${CDN}/images/shop/hat-brown-tan.jpg`],
    thumbnailUrl: `${CDN}/images/shop/hat-brown-tan.jpg`,
    hasSizes: false,
    stock: 0,
  },
  {
    itemId: 'hat-orange-navy',
    name: '6S Trucker Hat — Orange/Navy',
    description: '',
    price: 24.95,
    category: 'hats',
    photos: [`${CDN}/images/shop/hat-orange-navy.jpg`],
    thumbnailUrl: `${CDN}/images/shop/hat-orange-navy.jpg`,
    hasSizes: false,
    stock: 0,
  },
  {
    itemId: 'tumbler-black',
    name: '6S Logo Tumbler — Black',
    description: '',
    price: 14.95,
    category: 'tumblers',
    photos: [`${CDN}/images/shop/tumbler-black.jpg`],
    thumbnailUrl: `${CDN}/images/shop/tumbler-black.jpg`,
    hasSizes: false,
    stock: 0,
  },
];

async function migrate() {
  const now = new Date().toISOString();
  for (const item of ITEMS) {
    await ddb.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...item, createdAt: now, updatedAt: now },
    }));
    console.log(`✓ ${item.name}`);
  }
  console.log(`\nDone. ${ITEMS.length} products written to ${TABLE_NAME}.`);
  console.log('Note: stock is 0 for all migrated items -- update via /admin/shop once real inventory counts are known.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
