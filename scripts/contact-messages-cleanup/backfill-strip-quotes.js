// backfill-strip-quotes.js
// One-off cleanup: re-runs the FIXED stripQuotedReply() logic against
// every existing contact_messages item's rawBodyText, and updates
// bodyText where the result differs from what's currently stored.
//
// Only touches messages that actually arrived via inbound email
// (processIncomingEmail.js) -- those are the only ones with a
// rawBodyText field at all. Messages submitted directly through the
// public contact form never had quoted-reply cruft to strip in the
// first place, so they're untouched by this script.
//
// SAFE BY DEFAULT: without --apply, this only PRINTS what it would
// change -- no writes happen. Review the dry-run output, then re-run
// with --apply once you're confident it looks right.
//
// Usage:
//   node backfill-strip-quotes.js            (dry run, no writes)
//   node backfill-strip-quotes.js --apply    (actually updates DynamoDB)

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { fromIni } = require('@aws-sdk/credential-providers');

const REGION = process.env.AWS_REGION || 'us-east-1';
const TABLE_NAME = process.env.CONTACT_MESSAGES_TABLE || 'contact_messages';
const APPLY = process.argv.includes('--apply');

// Unlike deploy.sh scripts (which pass --profile sixspur to every aws
// CLI call), an SDK client with no explicit credentials silently falls
// back to whatever the ambient default AWS profile/account happens to
// be -- which is exactly what caused the first run to fail with
// "ResourceNotFoundException" (the table genuinely doesn't exist in
// whatever account that default profile pointed at). Pinning this to
// the "sixspur" profile by default matches every other script here,
// and PROFILE=other-name node backfill-strip-quotes.js still overrides
// it if ever needed.
const PROFILE = process.env.PROFILE || 'sixspur';

const client = new DynamoDBClient({ region: REGION, credentials: fromIni({ profile: PROFILE }) });
const ddb = DynamoDBDocumentClient.from(client);

// Exact same function as the fixed lambda/processIncomingEmail/index.js --
// duplicated here rather than imported, matching this project's existing
// "duplicate per file/script" convention (no shared Lambda layer).
function stripQuotedReply(bodyText) {
  if (!bodyText) return bodyText;

  const patterns = [
    /\n\s*From:\s*.+\n\s*Date:\s*.+\n\s*To:\s*.+\n\s*Subject:\s*.+/i,
    /\n\s*(?:>\s*)*On\s.+\swrote:\s*\n/i,
    /\n\s*-{2,}\s*Original Message\s*-{2,}/i,
    /\n\s*_{10,}\s*\n/,
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

  if (earliestIndex === -1) return bodyText;

  const stripped = bodyText.slice(0, earliestIndex).trim();
  return stripped.length > 0 ? stripped : bodyText;
}

async function scanAllMessages() {
  const items = [];
  let lastEvaluatedKey;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    items.push(...(result.Items || []));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (will write to DynamoDB)' : 'DRY RUN (no writes -- pass --apply to actually update)'}`);
  console.log(`AWS profile: ${PROFILE}  ·  Region: ${REGION}`);
  console.log(`Scanning ${TABLE_NAME}...`);

  const items = await scanAllMessages();
  const withRawBody = items.filter((i) => i.rawBodyText);

  console.log(`Found ${items.length} total messages, ${withRawBody.length} with rawBodyText (inbound email replies).`);
  console.log('');

  let changedCount = 0;

  for (const item of withRawBody) {
    const recleaned = stripQuotedReply(item.rawBodyText);
    if (recleaned === item.bodyText) continue; // already clean, or nothing to change

    changedCount += 1;
    console.log(`--- messageId: ${item.messageId} (from: ${item.fromEmail}, received: ${item.receivedAt}) ---`);
    console.log(`BEFORE (${item.bodyText.length} chars):`);
    console.log(item.bodyText);
    console.log(`AFTER (${recleaned.length} chars):`);
    console.log(recleaned);
    console.log('');

    if (APPLY) {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { messageId: item.messageId },
          UpdateExpression: 'SET bodyText = :b',
          ExpressionAttributeValues: { ':b': recleaned },
        })
      );
      console.log(`  ✓ Updated in DynamoDB.\n`);
    }
  }

  console.log('===');
  console.log(`${changedCount} message(s) ${APPLY ? 'updated' : 'would be updated'}.`);
  if (!APPLY && changedCount > 0) {
    console.log('Re-run with --apply to actually write these changes.');
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
