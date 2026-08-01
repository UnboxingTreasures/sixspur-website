// processIncomingEmail.js
// Invoked synchronously by an SES receipt rule after the raw email has been
// stored to S3. Fetches the raw MIME from S3, parses it, matches it to an
// existing thread by sender email (or starts a new thread), and writes the
// message into contact_messages.
//
// Ported from Unboxing Treasures inbound-email pattern — order/shipping
// logic removed, adapted from MySQL to DynamoDB.

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { simpleParser } = require('mailparser');
const { randomUUID } = require('crypto');

/**
 * Strips reply/forward prefixes and normalizes whitespace/case so
 * "Re: Adoption Inquiry" and "adoption inquiry" compare as the same subject.
 */
function normalizeSubject(subject) {
  return (subject || '')
    .replace(/^(re|fwd?):\s*/i, '')
    .trim()
    .toLowerCase();
}

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.CONTACT_MESSAGES_TABLE || 'contact_messages';
const INCOMING_BUCKET = process.env.INCOMING_MAIL_BUCKET || 'sixspurranch-incoming-mail';

// Addresses the system itself sends from. Since the SES receipt rule
// catches ALL mail to richard@sixspurranch.org — including the admin
// notification email the system sends to that same address on every
// contact form submission — we need to explicitly ignore mail from our
// own system addresses, or every form submission would create a second,
// spurious "message" that's really just our own notification bouncing
// back through the receiving pipeline.
const SYSTEM_ADDRESSES = new Set(
  (process.env.SYSTEM_SENDER_ADDRESSES || 'noreply@sixspurranch.org')
    .split(',')
    .map((addr) => addr.trim().toLowerCase())
    .filter(Boolean)
);

/**
 * Reads and parses the raw email object from S3.
 */
async function fetchAndParseEmail(objectKey) {
  const { Body } = await s3.send(
    new GetObjectCommand({ Bucket: INCOMING_BUCKET, Key: objectKey })
  );

  const rawEmail = await Body.transformToByteArray();
  const parsed = await simpleParser(Buffer.from(rawEmail));

  const fromAddress = parsed.from?.value?.[0]?.address || '';
  const fromName = parsed.from?.value?.[0]?.name || fromAddress;
  const subject = parsed.subject || '(no subject)';
  const bodyText = parsed.text || parsed.html || '(empty message)';

  return { fromAddress, fromName, subject, bodyText };
}

/**
 * Finds an existing thread for this sender IF the subject also matches
 * (after stripping Re:/Fwd: prefixes). Matching on sender alone was
 * incorrectly merging unrelated conversations from the same person into
 * one thread — e.g. a donation question and a separate adoption question
 * from the same email address would get lumped together. Requiring the
 * subject to line up too keeps genuinely separate conversations apart.
 */
async function findExistingThread(fromEmail, subject) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'fromEmail-index',
      KeyConditionExpression: 'fromEmail = :email',
      ExpressionAttributeValues: { ':email': fromEmail.toLowerCase() },
      ScanIndexForward: false, // most recent first
    })
  );

  const items = result.Items || [];
  const normalizedIncoming = normalizeSubject(subject);

  const match = items.find((item) => normalizeSubject(item.subject) === normalizedIncoming);

  return match ? match.threadId : null;
}

/**
 * Writes the inbound message into contact_messages, attached to an existing
 * thread if one was found, or starting a new one otherwise.
 */
async function saveInboundMessage({ fromName, fromEmail, subject, bodyText }) {
  const existingThreadId = await findExistingThread(fromEmail, subject);

  const messageId = randomUUID();
  const threadId = existingThreadId || randomUUID();
  const receivedAt = new Date().toISOString();

  const item = {
    messageId,
    threadId,
    fromEmail: fromEmail.toLowerCase(),
    fromName,
    subject,
    bodyText,
    isRead: false,
    isReplied: false,
    receivedAt,
    repliedAt: null,
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

  return { messageId, threadId, isNewThread: !existingThreadId };
}

exports.handler = async (event) => {
  // SES Lambda receipt actions deliver an event shaped like:
  // { Records: [{ ses: { mail: { messageId, destination, ... } } }] }
  // The raw email itself was already stored to S3 by the preceding S3
  // receipt action, keyed by the SES messageId.
  for (const record of event.Records || []) {
    const sesMessageId = record.ses?.mail?.messageId;
    if (!sesMessageId) {
      console.error('Record missing ses.mail.messageId, skipping:', JSON.stringify(record));
      continue;
    }

    try {
      const { fromAddress, fromName, subject, bodyText } = await fetchAndParseEmail(sesMessageId);

      if (!fromAddress) {
        console.error(`Could not parse sender address for SES message ${sesMessageId}, skipping.`);
        continue;
      }

      if (SYSTEM_ADDRESSES.has(fromAddress.toLowerCase())) {
        console.log(
          `Skipping SES message ${sesMessageId} — from system address ${fromAddress} ` +
            `(this is our own outbound notification, not a real inquiry).`
        );
        continue;
      }

      const { messageId, threadId, isNewThread } = await saveInboundMessage({
        fromName,
        fromEmail: fromAddress,
        subject,
        bodyText,
      });

      console.log(
        `Saved inbound message ${messageId} to thread ${threadId} ` +
          `(${isNewThread ? 'new thread' : 'existing thread'})`
      );
    } catch (err) {
      console.error(`Failed to process SES message ${sesMessageId}:`, err);
      // Don't rethrow — one malformed email shouldn't fail the whole batch,
      // and SES doesn't retry Lambda receipt actions on failure anyway.
    }
  }

  return { status: 'processed' };
};
