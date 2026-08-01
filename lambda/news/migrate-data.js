// migrate-data.js
// One-time migration: loads the existing src/data/news.json and writes each
// post into the news_posts DynamoDB table. Safe to re-run — uses PutItem,
// which overwrites by slug rather than duplicating.
//
// Run from lambda/news/ with: node migrate-data.js

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const path = require('path');

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'news_posts';
const NEWS_JSON_PATH = path.join(__dirname, '..', '..', 'src', 'data', 'news.json');

async function migrate() {
  const posts = require(NEWS_JSON_PATH);

  console.log(`Found ${posts.length} posts in news.json. Migrating...`);

  for (const post of posts) {
    const item = {
      slug: post.id,
      title: post.title,
      category: post.category,
      // news.json only has an excerpt, no full article body yet — using the
      // excerpt as a placeholder for content so the detail page isn't empty.
      // Edit these in the admin UI to add real article bodies.
      excerpt: post.excerpt,
      content: post.excerpt,
      image: post.image,
      author: 'Richard McGuire',
      isPublished: 'true',
      publishedAt: new Date(post.date).toISOString(),
    };

    await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    console.log(`  Migrated: ${item.slug}`);
  }

  console.log('Done.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
