// dynamo.js
// Data access layer for the admin inbox. Uses Scan + in-memory filter/sort
// because contact_messages doesn't have GSIs shaped for "list all, filtered
// and paginated" — reasonable at a small rescue's message volume, but worth
// revisiting with a proper query pattern if volume grows substantially.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const TABLE_NAME = process.env.CONTACT_MESSAGES_TABLE || 'contact_messages';
const PDF_BUCKET = process.env.ADOPTION_PDF_BUCKET || 'sixspurranch-adoption-pdfs';
const UPLOADS_BUCKET = process.env.ADOPTION_UPLOADS_BUCKET || 'sixspurranch-adoption-uploads';

/**
 * If a message has an attached adoption application PDF and/or fence
 * photos, generates short-lived presigned download URLs for them rather
 * than exposing raw S3 keys (both buckets are private — applications and
 * uploaded photos contain applicant PII).
 */
async function attachDownloadUrls(message) {
  if (!message) return message;

  let result = { ...message };

  if (message.pdfKey) {
    try {
      const command = new GetObjectCommand({ Bucket: PDF_BUCKET, Key: message.pdfKey });
      result.pdfDownloadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
    } catch (err) {
      console.error(`Failed to generate PDF download URL for ${message.messageId}:`, err);
    }
  }

  if (message.fencePhotoKeys && message.fencePhotoKeys.length > 0) {
    try {
      result.fencePhotoDownloadUrls = await Promise.all(
        message.fencePhotoKeys.map(async (key) => {
          const command = new GetObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key });
          const url = await getSignedUrl(s3, command, { expiresIn: 900 });
          return { key, url };
        })
      );
    } catch (err) {
      console.error(`Failed to generate fence photo URLs for ${message.messageId}:`, err);
    }
  }

  return result;
}

/**
 * Lists messages with optional unread filter, search term, and pagination.
 * One row per message (not collapsed by thread) — matches the original
 * Unboxing Treasures inbox list behavior.
 *
 * Soft-deleted messages (isDeleted: true) are excluded by default. Pass
 * includeDeleted: true to show them too (the "Show Deleted" toggle) --
 * this is purely a display filter, nothing is ever actually removed from
 * the table by this function.
 */
async function listMessages({ filter, search, page = 1, limit = 20, includeDeleted = false }) {
  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  let items = includeDeleted ? (result.Items || []) : (result.Items || []).filter((m) => !m.isDeleted);

  if (filter === 'unread') {
    items = items.filter((m) => !m.isRead);
  }

  if (search) {
    const term = search.toLowerCase();
    items = items.filter(
      (m) =>
        (m.fromEmail || '').toLowerCase().includes(term) ||
        (m.fromName || '').toLowerCase().includes(term) ||
        (m.subject || '').toLowerCase().includes(term) ||
        (m.bodyText || '').toLowerCase().includes(term)
    );
  }

  items.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

  const nonDeleted = (result.Items || []).filter((m) => !m.isDeleted);
  const unreadCount = nonDeleted.filter((m) => !m.isRead).length;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const pageItems = items.slice(start, start + limit);

  return {
    messages: pageItems,
    pagination: { page, total, totalPages, limit },
    unreadCount,
  };
}

/**
 * Gets a single message plus every other message in the same thread,
 * oldest first (so the conversation reads top to bottom).
 */
async function getMessageWithThread(messageId) {
  const { Item: message } = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { messageId } })
  );

  if (!message) return null;

  const threadResult = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'threadId-index',
      KeyConditionExpression: 'threadId = :t',
      ExpressionAttributeValues: { ':t': message.threadId },
      ScanIndexForward: true, // oldest first
    })
  );

  const messageWithDownloads = await attachDownloadUrls(message);

  return { message: messageWithDownloads, threadMessages: threadResult.Items || [] };
}

async function setReadStatus(messageId, isRead) {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { messageId },
      UpdateExpression: 'SET isRead = :r',
      ExpressionAttributeValues: { ':r': isRead },
    })
  );
}

async function markReplied(messageId) {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { messageId },
      UpdateExpression: 'SET isReplied = :r, repliedAt = :t',
      ExpressionAttributeValues: { ':r': true, ':t': new Date().toISOString() },
    })
  );
}

async function batchSetReadStatus(messageIds, isRead) {
  await Promise.all(messageIds.map((id) => setReadStatus(id, isRead)));
}

/**
 * Soft-deletes a message: sets isDeleted + deletedAt, but never removes the
 * DynamoDB item itself. Restoring later is just clearing this flag --
 * no data is actually destroyed by this operation.
 */
async function setDeletedStatus(messageId, isDeleted) {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { messageId },
      ConditionExpression: 'attribute_exists(messageId)',
      UpdateExpression: 'SET isDeleted = :d, deletedAt = :t',
      ExpressionAttributeValues: {
        ':d': isDeleted,
        ':t': isDeleted ? new Date().toISOString() : null,
      },
    })
  ).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  });
}

async function batchSetDeletedStatus(messageIds, isDeleted) {
  await Promise.all(messageIds.map((id) => setDeletedStatus(id, isDeleted)));
}

module.exports = {
  listMessages,
  getMessageWithThread,
  setReadStatus,
  markReplied,
  batchSetReadStatus,
  setDeletedStatus,
  batchSetDeletedStatus,
};
