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
 * Public: lists published posts, newest first, optionally filtered by
 * category. Archived posts are excluded even if isPublished is still
 * "true" -- archiving is meant to pull a post off the public site
 * regardless of its publish state, not just a variant of unpublishing.
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
  // isArchived may not exist on older records -- undefined !== 'true'
  // correctly treats those as not-archived rather than requiring a
  // backfill/migration.
  items = items.filter((p) => p.isArchived !== 'true');
  if (category) {
    items = items.filter((p) => p.category === category);
  }
  return items;
}

/**
 * Admin: lists ALL posts regardless of status (published, draft, AND
 * archived), newest first. The admin page itself splits this into the
 * active list and the archived table -- this stays a single unfiltered
 * list so that split can happen client-side rather than needing two
 * separate Lambda routes for what's really one dataset.
 * Small table, scan + in-memory sort is fine at this volume.
 */
async function listAllPosts() {
  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  const items = result.Items || [];
  items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  return items;
}

/**
 * Public: gets a single post by slug, but only if published AND not
 * archived (prevents leaking drafts or archived posts via a guessed or
 * previously-bookmarked URL).
 */
async function getPublishedPost(slug) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { slug } }));
  if (!Item || Item.isPublished !== 'true' || Item.isArchived === 'true') return null;
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
    isArchived: 'false',
    publishedAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

/**
 * Updates an existing post. Only provided fields are changed.
 * `archived` follows the exact same pattern as `published` below --
 * a boolean in the request body that maps to a string field plus a
 * timestamp, not a separate route.
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

  if (updates.archived !== undefined) {
    setClauses.push('#isArchived = :isArchived');
    names['#isArchived'] = 'isArchived';
    values[':isArchived'] = updates.archived ? 'true' : 'false';
    if (updates.archived) {
      setClauses.push('archivedAt = :archivedAt');
      values[':archivedAt'] = new Date().toISOString();
    }
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
