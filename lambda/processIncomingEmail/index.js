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
const { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { simpleParser } = require('mailparser');
const { randomUUID } = require('crypto');
const { notifyAdminOfEmail } = require('./notify');

/**
 * Strips reply/forward prefixes and normalizes whitespace/case so
 * "Re: Adoption Inquiry" and "adoption inquiry" compare as the same subject.
 *
 * Uses a repeating group (+) rather than a single match, since email
 * clients commonly stack these ("Re: Re: Subject", "Fwd: Re: Subject") on
 * a reply-to-a-reply. Stripping only one prefix left "re: subject" instead
 * of "subject" for double-Re: chains, which failed to match the thread's
 * already-normalized subject and incorrectly started a new thread instead
 * of continuing the existing conversation.
 */
function normalizeSubject(subject) {
  return (subject || '')
    .replace(/^(?:(?:re|fwd?):\s*)+/i, '')
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

// Third-party automated senders that legitimately email richard@ but aren't
// real inquiries -- DMARC aggregate report generators being the first case
// (added Aug 10, 2026). Kept as a separate set from SYSTEM_ADDRESSES above,
// since the reason for ignoring these is different (external automated
// reporting, not our own outbound mail looping back) even though the
// handling is the same. Add more addresses here, comma-separated, via the
// IGNORED_SENDER_ADDRESSES env var if other automated senders show up later
// (e.g. other mailbox providers' DMARC reporters) rather than editing code.
const IGNORED_SENDER_ADDRESSES = new Set(
  (process.env.IGNORED_SENDER_ADDRESSES || 'postmaster@amazonses.com,noreply-dmarc-support@google.com')
    .split(',')
    .map((addr) => addr.trim().toLowerCase())
    .filter(Boolean)
);

/**
 * Strips the quoted-previous-message block that email clients automatically
 * append when someone replies -- e.g. Apple Mail / Outlook's plain-text
 * "From: / Date: / To: / Subject:" header block, Gmail's "On <date>, <name>
 * wrote:" line, or classic Outlook's "-----Original Message-----" marker.
 * Now that the Conversation Thread view already reconstructs the full
 * back-and-forth from separately-stored messages, this quoted text is pure
 * redundancy -- it only ever duplicated what's already shown below it.
 *
 * Deliberately conservative: if none of the known patterns match, or if
 * stripping would leave nothing behind (e.g. someone forwarded a whole
 * email with no new text of their own), the original text is returned
 * unchanged rather than risk hiding real content.
 *
 * UPDATED -- the "On ... wrote:" pattern previously required NO characters
 * before "On" other than whitespace, which is correct for Gmail's web
 * client but wrong for Apple Mail's plain-text replies (iPhone/iPad/Mac):
 * Apple Mail quote-prefixes that specific line with "> " too, the same as
 * every other quoted line below it. That leading ">" isn't whitespace, so
 * the old regex silently failed to match at all on any reply sent from an
 * iPhone -- nothing got stripped, and the raw "> On ... wrote:" plus every
 * quoted line under it went straight into bodyText. Also added a pattern
 * for "Sent from my iPhone"-style mobile signatures, which sit between the
 * person's real typed reply and the quoted block and were previously left
 * in untouched even on the rare reply that DID match the old pattern.
 */
function stripQuotedReply(bodyText) {
  if (!bodyText) return bodyText;

  const patterns = [
    // Apple Mail / Outlook desktop plain-text quote header block
    /\n\s*From:\s*.+\n\s*Date:\s*.+\n\s*To:\s*.+\n\s*Subject:\s*.+/i,
    // Gmail-style / Apple Mail plain-text: "On Mon, Aug 10, 2026 at 12:35 PM
    // Richard <...> wrote:" -- the (?:>\s*)* allows for zero or more ">"
    // blockquote markers immediately before "On", since Apple Mail
    // prefixes this exact line with "> " (Gmail's web client doesn't).
    /\n\s*(?:>\s*)*On\s.+\swrote:\s*\n/i,
    // Classic Outlook
    /\n\s*-{2,}\s*Original Message\s*-{2,}/i,
    // Some clients insert a long underscore divider before quoted content
    /\n\s*_{10,}\s*\n/,
    // Mobile client auto-signatures. These always sit between the
    // person's actual typed reply and the quoted block below it, so
    // stripping from here also removes everything after it -- which is
    // exactly the quoted content we don't want anyway, not just the
    // signature line itself.
    /\n\s*Sent from my (?:iPhone|iPad|Android|Samsung(?:\s\w+)*|Mobile)\s*\n/i,
  ];

  let earliestIndex = -1;
  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match && match.index !== undefined) {
      if (earliestIndex === -1 || match.index < earliestIndex) {
        earliestIndex = match.index;
      }
    }
  }

  if (earliestIndex === -1) return bodyText; // no known quote pattern found

  const stripped = bodyText.slice(0, earliestIndex).trim();
  return stripped.length > 0 ? stripped : bodyText; // never return an empty body
}

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

  // Real email threading identifiers -- mailparser already extracts these
  // from the raw headers. inReplyTo is the direct parent; references is
  // the full chain back to the start of the conversation (some clients
  // only set one or the other, so we check both when matching threads).
  const emailMessageId = parsed.messageId || null;
  const inReplyTo = parsed.inReplyTo || null;
  const references = Array.isArray(parsed.references)
    ? parsed.references
    : (parsed.references ? [parsed.references] : []);

  return { fromAddress, fromName, subject, bodyText, emailMessageId, inReplyTo, references };
}

/**
 * Finds an existing thread, preferring real email threading headers
 * (In-Reply-To / References) over subject text, since those are globally
 * unique and unambiguous -- unlike subject strings, which can collide
 * ("General Inquiries" from two different people, or two genuinely
 * separate conversations from the same person that happen to share a
 * subject). Subject+sender matching is kept ONLY as a fallback for emails
 * that arrive without proper threading headers.
 */
async function findExistingThreadByEmailHeaders(inReplyTo, references) {
  const candidateIds = [inReplyTo, ...references].filter(Boolean);
  if (candidateIds.length === 0) return null;

  for (const id of candidateIds) {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'emailMessageId-index',
        KeyConditionExpression: 'emailMessageId = :id',
        ExpressionAttributeValues: { ':id': id },
        Limit: 1,
      })
    );
    if (result.Items && result.Items.length > 0) {
      return result.Items[0].threadId;
    }
  }
  return null;
}

/**
 * Finds an existing thread for this sender IF the subject also matches
 * (after stripping Re:/Fwd: prefixes). Matching on sender alone was
 * incorrectly merging unrelated conversations from the same person into
 * one thread — e.g. a donation question and a separate adoption question
 * from the same email address would get lumped together. Requiring the
 * subject to line up too keeps genuinely separate conversations apart.
 *
 * FALLBACK ONLY -- used when the email has no In-Reply-To/References we
 * can match, or when neither points at anything we have stored.
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
 * If a new reply lands on a thread that was previously (soft-)deleted in
 * the admin panel, un-deletes the WHOLE thread automatically -- a live
 * response from the visitor means it needs attention again, so it
 * shouldn't stay silently hidden. Does nothing if the thread wasn't
 * deleted (the common case), so this is cheap for normal traffic.
 */
async function restoreThreadIfDeleted(threadId) {
  const threadResult = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'threadId-index',
      KeyConditionExpression: 'threadId = :t',
      ExpressionAttributeValues: { ':t': threadId },
    })
  );

  const items = threadResult.Items || [];
  const anyDeleted = items.some((m) => m.isDeleted);
  if (!anyDeleted) return;

  console.log(`Thread ${threadId} was deleted -- auto-restoring since a new reply just arrived.`);

  await Promise.all(
    items.map((item) =>
      ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { messageId: item.messageId },
          UpdateExpression: 'SET isDeleted = :d, deletedAt = :t',
          ExpressionAttributeValues: { ':d': false, ':t': null },
        })
      )
    )
  );
}

/**
 * Writes the inbound message into contact_messages, attached to an existing
 * thread if one was found, or starting a new one otherwise. Tries real
 * email threading headers first; falls back to subject+sender matching
 * only if those don't resolve to anything.
 */
async function saveInboundMessage({ fromName, fromEmail, subject, bodyText, emailMessageId, inReplyTo, references }) {
  let existingThreadId = await findExistingThreadByEmailHeaders(inReplyTo, references);
  if (!existingThreadId) {
    existingThreadId = await findExistingThread(fromEmail, subject);
  }

  if (existingThreadId) {
    await restoreThreadIfDeleted(existingThreadId);
  }

  const messageId = randomUUID();
  const threadId = existingThreadId || randomUUID();
  const receivedAt = new Date().toISOString();
  const cleanBodyText = stripQuotedReply(bodyText);

  const item = {
    messageId,
    threadId,
    fromEmail: fromEmail.toLowerCase(),
    fromName,
    subject,
    emailMessageId,
    inReplyTo,
    bodyText: cleanBodyText,
    rawBodyText: bodyText, // original, unstripped -- kept for reference, never displayed by default
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
      const { fromAddress, fromName, subject, bodyText, emailMessageId, inReplyTo, references } = await fetchAndParseEmail(sesMessageId);

      if (!fromAddress) {
        console.error(`Could not parse sender address for SES message ${sesMessageId}, skipping.`);
        continue;
      }

      const fromLower = fromAddress.toLowerCase();

      if (SYSTEM_ADDRESSES.has(fromLower)) {
        console.log(
          `Skipping SES message ${sesMessageId} — from system address ${fromAddress} ` +
            `(this is our own outbound notification, not a real inquiry).`
        );
        continue;
      }

      if (IGNORED_SENDER_ADDRESSES.has(fromLower)) {
        console.log(
          `Skipping SES message ${sesMessageId} — from ${fromAddress} ` +
            `(known automated sender, e.g. a DMARC aggregate report, not a real inquiry).`
        );
        continue;
      }

      const { messageId, threadId, isNewThread } = await saveInboundMessage({
        fromName,
        fromEmail: fromAddress,
        subject,
        bodyText,
        emailMessageId,
        inReplyTo,
        references,
      });

      console.log(
        `Saved inbound message ${messageId} to thread ${threadId} ` +
          `(${isNewThread ? 'new thread' : 'existing thread'})`
      );

      try {
        await notifyAdminOfEmail({ fromName, fromEmail: fromAddress, subject });
      } catch (smsErr) {
        console.error(`Message ${messageId} saved but SMS notification failed:`, smsErr);
      }
    } catch (err) {
      console.error(`Failed to process SES message ${sesMessageId}:`, err);
      // Don't rethrow — one malformed email shouldn't fail the whole batch,
      // and SES doesn't retry Lambda receipt actions on failure anyway.
    }
  }

  return { status: 'processed' };
};
