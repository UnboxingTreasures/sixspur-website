// dynamo.js
// Data access layer for news_posts.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.NEWS_POSTS_TABLE || 'news_posts';

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Public: lists published posts, newest first, optionally filtered by category.
 */
async function listPublishedPosts({ category } = {}) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'published-index',
      KeyConditionExpression: 'isPublished = :p',
      ExpressionAttributeValues: { ':p': 'true' },
      ScanIndexForward: false, // newest first
    })
  );

  let items = result.Items || [];
  if (category) {
    items = items.filter((p) => p.category === category);
  }
  return items;
}

/**
 * Admin: lists ALL posts regardless of status, newest first.
 * Small table, scan + in-memory sort is fine at this volume.
 */
async function listAllPosts() {
  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  const items = result.Items || [];
  items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  return items;
}

/**
 * Public: gets a single post by slug, but only if published (prevents
 * leaking drafts via a guessed URL).
 */
async function getPublishedPost(slug) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { slug } }));
  if (!Item || Item.isPublished !== 'true') return null;
  return Item;
}

/**
 * Admin: gets a single post by slug regardless of status.
 */
async function getPostForAdmin(slug) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { slug } }));
  return Item || null;
}

/**
 * Creates a new post. Slug is auto-generated from title if not provided,
 * with a numeric suffix appended on collision.
 */
async function createPost({ title, slug, category, excerpt, content, image, author, published }) {
  let finalSlug = slug && slug.trim() ? slug.trim() : slugify(title);

  let suffix = 1;
  const baseSlug = finalSlug;
  while (await getPostForAdmin(finalSlug)) {
    suffix += 1;
    finalSlug = `${baseSlug}-${suffix}`;
  }

  const item = {
    slug: finalSlug,
    title,
    category: category || 'Ranch Updates',
    excerpt: excerpt || '',
    content: content || '',
    image: image || '',
    author: author || 'Richard McGuire',
    isPublished: published ? 'true' : 'false',
    publishedAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

/**
 * Updates an existing post. Only provided fields are changed.
 */
async function updatePost(slug, updates) {
  const fields = ['title', 'category', 'excerpt', 'content', 'image', 'author'];
  const setClauses = [];
  const values = {};
  const names = {};

  for (const field of fields) {
    if (updates[field] !== undefined) {
      setClauses.push(`#${field} = :${field}`);
      names[`#${field}`] = field;
      values[`:${field}`] = updates[field];
    }
  }

  if (updates.published !== undefined) {
    setClauses.push('#isPublished = :isPublished');
    names['#isPublished'] = 'isPublished';
    values[':isPublished'] = updates.published ? 'true' : 'false';
  }

  if (setClauses.length === 0) {
    return getPostForAdmin(slug);
  }

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { slug },
      UpdateExpression: `SET ${setClauses.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );

  return getPostForAdmin(slug);
}

async function deletePost(slug) {
  await ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { slug } }));
}

module.exports = {
  listPublishedPosts,
  listAllPosts,
  getPublishedPost,
  getPostForAdmin,
  createPost,
  updatePost,
  deletePost,
};
