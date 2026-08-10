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
  PutCommand,
} = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const TABLE_NAME = process.env.CONTACT_MESSAGES_TABLE || 'contact_messages';
const ADMIN_ADDRESS = process.env.SES_ADMIN_ADDRESS || 'richard@sixspurranch.org';
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
/**
 * Lists CONVERSATIONS, not individual messages -- one row per threadId,
 * not one row per message. Previously each reply in a back-and-forth
 * showed up as its own separate inbox row ("General Inquiries", then
 * "Re: General Inquiries", then "Re: Re: General Inquiries" all as
 * distinct entries), even though clicking into any of them already
 * correctly showed the full Conversation Thread -- the LIST just never
 * collapsed them the way the detail view already did.
 *
 * Each returned row represents a thread:
 *   - messageId: the most recent VISITOR message's id (used for viewing)
 *   - allMessageIds: every message id in the thread (visitor + outbound),
 *     used so delete/restore can act on the whole conversation at once
 *   - subject: the ORIGINAL (first) message's subject, so the list doesn't
 *     show an ever-growing "Re: Re: Re:" chain -- just the base subject,
 *     same as how a normal email client's thread list behaves
 *   - isRead: false if ANY message in the thread is unread
 *   - isReplied: true if ANY message in the thread has been replied to
 *   - receivedAt: the most recent message's timestamp, used for sorting
 */
async function listMessages({ filter, search, page = 1, limit = 20, includeDeleted = false }) {
  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  const baseItems = (result.Items || []).filter((m) => !m.isOutbound);
  let items = includeDeleted ? baseItems : baseItems.filter((m) => !m.isDeleted);

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

  // Group the (already filtered) visitor messages by thread.
  const threadGroups = new Map();
  for (const item of items) {
    if (!threadGroups.has(item.threadId)) threadGroups.set(item.threadId, []);
    threadGroups.get(item.threadId).push(item);
  }

  let threadRows = [];
  for (const [threadId, msgs] of threadGroups) {
    const sorted = [...msgs].sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));
    const original = sorted[0];
    const latest = sorted[sorted.length - 1];

    threadRows.push({
      messageId: latest.messageId,
      allMessageIds: msgs.map((m) => m.messageId),
      threadId,
      fromEmail: latest.fromEmail,
      fromName: latest.fromName,
      subject: original.subject,
      bodyText: latest.bodyText,
      isRead: !msgs.some((m) => !m.isRead),
      isReplied: msgs.some((m) => m.isReplied),
      isDeleted: msgs.every((m) => m.isDeleted), // consistent since delete/restore act on the whole thread
      receivedAt: latest.receivedAt,
      messageCount: msgs.length,
    });
  }

  if (filter === 'unread') {
    threadRows = threadRows.filter((t) => !t.isRead);
  }

  threadRows.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

  // Unread count is threads-with-an-unread-message, not raw message count --
  // matches what the "Unread" tab button is actually filtering on above.
  const allThreadsMap = new Map();
  for (const item of baseItems.filter((m) => !m.isDeleted)) {
    if (!allThreadsMap.has(item.threadId)) allThreadsMap.set(item.threadId, []);
    allThreadsMap.get(item.threadId).push(item);
  }
  let unreadCount = 0;
  for (const msgs of allThreadsMap.values()) {
    if (msgs.some((m) => !m.isRead)) unreadCount += 1;
  }

  const total = threadRows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const pageItems = threadRows.slice(start, start + limit);

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

/**
 * Cheap lookup for just a message's threadId, used when saving Richard's
 * reply -- avoids the extra thread Query that getMessageWithThread does,
 * since all that's needed here is the one field.
 */
async function getThreadId(messageId) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: { messageId } }));
  return Item?.threadId || null;
}

/**
 * Saves Richard's own reply as a real message in the same thread, so the
 * Conversation Thread view shows both sides of the conversation instead of
 * only the visitor's messages. Previously his replies only ever existed as
 * a sent email, never stored here -- which is also why a visitor's next
 * reply looked cluttered: their email client had nothing to quote from our
 * side except its own guess, so it pasted the whole prior email back in.
 */
async function saveOutboundReply({ threadId, subject, bodyText }) {
  const messageId = randomUUID();
  const now = new Date().toISOString();

  const item = {
    messageId,
    threadId,
    fromEmail: ADMIN_ADDRESS,
    fromName: 'Richard',
    subject,
    bodyText,
    isRead: true, // it's our own outbound message, nothing to "read"
    isReplied: false,
    isOutbound: true, // marks this as Richard's own reply, not a real inbound
                       // inquiry -- listMessages excludes these from the main
                       // list, but getMessageWithThread's threadId query does
                       // NOT filter on this, so it still shows correctly
                       // inside the Conversation Thread view.
    receivedAt: now,
    repliedAt: null,
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return { messageId };
}

/**
 * Deletes or restores an ENTIRE thread (every message in it, including
 * Richard's outbound replies), not just the one message passed in. Now
 * that the list shows one row per conversation, a "partial" delete --
 * some messages in a thread deleted, others not -- would be a confusing
 * state with no clear meaning in the UI, so this always acts on the whole
 * thread together.
 */
async function setThreadDeletedStatus(messageId, isDeleted) {
  const threadId = await getThreadId(messageId);
  if (!threadId) return null;

  const threadResult = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'threadId-index',
      KeyConditionExpression: 'threadId = :t',
      ExpressionAttributeValues: { ':t': threadId },
    })
  );

  const allMessageIds = (threadResult.Items || []).map((m) => m.messageId);
  await Promise.all(allMessageIds.map((id) => setDeletedStatus(id, isDeleted)));
  return { threadId, messageIds: allMessageIds };
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

/**
 * Sets read status across an ENTIRE thread. Now that the list shows one
 * row per conversation (not per message), marking "read" from the list
 * needs to clear every message in the thread -- otherwise an older unread
 * message could still be sitting in there, and the thread would
 * incorrectly keep showing as unread after being marked read.
 */
async function setThreadReadStatus(messageId, isRead) {
  const threadId = await getThreadId(messageId);
  if (!threadId) return null;

  const threadResult = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'threadId-index',
      KeyConditionExpression: 'threadId = :t',
      ExpressionAttributeValues: { ':t': threadId },
    })
  );

  const allMessageIds = (threadResult.Items || []).map((m) => m.messageId);
  await Promise.all(allMessageIds.map((id) => setReadStatus(id, isRead)));
  return { threadId, messageIds: allMessageIds };
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
 * Soft-deletes or restores a message. Sets isDeleted + deletedAt either way.
 * On restore specifically (isDeleted: false), also resets isRead to false --
 * a message coming back from deleted should show up as unread/"New" again
 * so it doesn't get silently missed, regardless of what its read state was
 * before it was deleted.
 */
async function setDeletedStatus(messageId, isDeleted) {
  const expressionValues = {
    ':d': isDeleted,
    ':t': isDeleted ? new Date().toISOString() : null,
  };
  let updateExpression = 'SET isDeleted = :d, deletedAt = :t';

  if (!isDeleted) {
    updateExpression += ', isRead = :r';
    expressionValues[':r'] = false;
  }

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { messageId },
      ConditionExpression: 'attribute_exists(messageId)',
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionValues,
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
  getThreadId,
  saveOutboundReply,
  setReadStatus,
  markReplied,
  batchSetReadStatus,
  setDeletedStatus,
  batchSetDeletedStatus,
  setThreadDeletedStatus,
  setThreadReadStatus,
};
