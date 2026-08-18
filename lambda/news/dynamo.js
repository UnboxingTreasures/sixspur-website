// dynamo.js
// Data access layer for news_posts, and (Session 20) blog_comments --
// kept in the SAME Lambda/file as the posts themselves rather than a
// separate Lambda, since this file already established the mixed
// public/admin pattern comments also need (public read, donor-gated
// write, admin moderation).

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
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.NEWS_POSTS_TABLE || 'news_posts';
const COMMENTS_TABLE = process.env.BLOG_COMMENTS_TABLE || 'blog_comments';
const DONORS_TABLE = process.env.DONORS_TABLE || 'donors';

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function listPublishedPosts({ category } = {}) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'published-index',
      KeyConditionExpression: 'isPublished = :p',
      ExpressionAttributeValues: { ':p': 'true' },
      ScanIndexForward: false,
    })
  );

  let items = result.Items || [];
  if (category) {
    items = items.filter((p) => p.category === category);
  }
  return items;
}

async function listAllPosts() {
  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  const items = result.Items || [];
  items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  return items;
}

async function getPublishedPost(slug) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { slug } }));
  if (!Item || Item.isPublished !== 'true') return null;
  return Item;
}

async function getPostForAdmin(slug) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { slug } }));
  return Item || null;
}

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

// ── Blog comments (NEW Session 20, revised to match Unboxing Treasures'
//    existing comment UX per Jay's direction) ───────────────────────────
// Soft-delete only (isDeleted flag), never a hard DELETE -- matches the
// "mark, don't delete" convention already established elsewhere in this
// project. No separate admin moderation TABLE VIEW anymore -- moderation
// happens inline on the post itself (admin sees a Delete link directly
// on each comment), so there's no listAllCommentsForAdmin() here now,
// just the same softDeleteComment() an admin's inline click calls.

const MAX_COMMENT_LENGTH = 1000; // matches Unboxing Treasures' limit

/**
 * Creates a comment OR a reply (if parentCommentId is provided).
 * Requires the donor to already have a `name` set on their profile.
 * Also snapshots isAdmin at post time -- this is what drives the
 * "Admin" badge shown next to the commenter's name; it reflects admin
 * status AT THE TIME OF COMMENTING, same reasoning as snapshotting
 * donorName rather than joining live on every read.
 */
async function createComment({ slug, donorId, body, parentCommentId }) {
  const trimmedBody = String(body || '').trim();
  if (!trimmedBody) throw new Error('Comment cannot be empty');
  if (trimmedBody.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Comments must be ${MAX_COMMENT_LENGTH} characters or fewer`);
  }

  const donorResult = await ddb.send(new GetCommand({ TableName: DONORS_TABLE, Key: { donorId } }));
  const donor = donorResult.Item;
  if (!donor?.name) {
    const err = new Error('Add a display name in your account settings before commenting');
    err.code = 'NO_NAME_SET';
    throw err;
  }

  // A reply can't itself be replied to -- one level of nesting only,
  // matching what Unboxing Treasures' UI actually supports. Validate
  // the parent exists and is itself a top-level comment (not already
  // a reply) before accepting.
  if (parentCommentId) {
    const parentResult = await ddb.send(new GetCommand({ TableName: COMMENTS_TABLE, Key: { commentId: parentCommentId } }));
    const parent = parentResult.Item;
    if (!parent || parent.isDeleted) throw new Error('The comment you are replying to no longer exists');
    if (parent.parentCommentId) throw new Error('Cannot reply to a reply');
    if (parent.slug !== slug) throw new Error('Invalid reply target');
  }

  const now = new Date().toISOString();
  const item = {
    commentId: randomUUID(),
    slug,
    donorId,
    donorName: donor.name,
    isAdminComment: Boolean(donor.isAdmin),
    body: trimmedBody,
    parentCommentId: parentCommentId || null,
    isDeleted: false,
    createdAt: now,
  };

  await ddb.send(new PutCommand({ TableName: COMMENTS_TABLE, Item: item }));
  return item;
}

/**
 * Public: lists non-deleted comments for a post, oldest first. Returns
 * a FLAT list (both top-level comments and replies together, each
 * tagged with parentCommentId) -- the frontend groups replies under
 * their parent for display, keeping this function's job simple (one
 * query, one filter).
 */
async function listCommentsForPost(slug) {
  const result = await ddb.send(new QueryCommand({
    TableName: COMMENTS_TABLE,
    IndexName: 'slug-index',
    KeyConditionExpression: 'slug = :slug',
    ExpressionAttributeValues: { ':slug': slug },
    ScanIndexForward: true,
  }));
  return (result.Items || []).filter((c) => !c.isDeleted);
}

/**
 * Admin: soft-deletes a comment OR a reply (moderation), called inline
 * from the post page itself now rather than a separate admin table.
 * Does NOT physically remove the row.
 */
async function softDeleteComment(commentId) {
  const result = await ddb.send(new UpdateCommand({
    TableName: COMMENTS_TABLE,
    Key: { commentId },
    ConditionExpression: 'attribute_exists(commentId)',
    UpdateExpression: 'SET isDeleted = :true, deletedAt = :now',
    ExpressionAttributeValues: { ':true': true, ':now': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  })).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  });

  return result ? result.Attributes : null;
}

module.exports = {
  listPublishedPosts,
  listAllPosts,
  getPublishedPost,
  getPostForAdmin,
  createPost,
  updatePost,
  deletePost,
  createComment,
  listCommentsForPost,
  softDeleteComment,
};
