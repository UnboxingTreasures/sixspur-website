// saveContactMessage.js
// Writes a new inbound contact message to the contact_messages DynamoDB table.
// Ported from Unboxing Treasures order-message pattern — order logic removed,
// adapted from MySQL to DynamoDB.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.CONTACT_MESSAGES_TABLE || 'contact_messages';

/**
 * Saves a new contact message as the first entry in a new thread.
 * Every inbound submission from the public /contact form starts a new thread;
 * replies (inbound or outbound) get appended to that thread's threadId later
 * by processIncomingEmail.js / the admin reply flow.
 *
 * @param {Object} params
 * @param {string} params.fromName
 * @param {string} params.fromEmail
 * @param {string} [params.fromPhone]
 * @param {string} params.subject
 * @param {string} params.bodyText
 * @returns {Promise<{messageId: string, threadId: string, receivedAt: string}>}
 */
async function saveContactMessage({ fromName, fromEmail, fromPhone, subject, bodyText }) {
  if (!fromName || !fromEmail || !bodyText) {
    throw new Error('fromName, fromEmail, and bodyText are required');
  }

  const messageId = randomUUID();
  const threadId = randomUUID(); // new thread — this is the first message in the conversation
  const receivedAt = new Date().toISOString();

  const item = {
    messageId,
    threadId,
    fromEmail: fromEmail.trim().toLowerCase(),
    fromName: fromName.trim(),
    fromPhone: fromPhone && fromPhone.trim() ? fromPhone.trim() : null,
    subject: subject && subject.trim() ? subject.trim() : 'New contact form submission',
    bodyText: bodyText.trim(),
    isRead: false,
    isReplied: false,
    receivedAt,
    repliedAt: null,
  };

  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return { messageId, threadId, receivedAt };
}

module.exports = { saveContactMessage };
