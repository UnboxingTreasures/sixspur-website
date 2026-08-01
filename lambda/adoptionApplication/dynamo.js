// dynamo.js
// Saves the adoption application into the same contact_messages table used
// by the general contact form, so it shows up in the existing admin inbox
// rather than needing a separate admin UI.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.CONTACT_MESSAGES_TABLE || 'contact_messages';

async function saveApplicationMessage({ applicationId, firstName, lastName, primaryEmail, primaryPhone, interestedIn, pdfKey, fencePhotoKeys }) {
  const messageId = randomUUID();
  const threadId = randomUUID(); // adoption applications always start a new thread
  const receivedAt = new Date().toISOString();

  const item = {
    messageId,
    threadId,
    fromEmail: primaryEmail.trim().toLowerCase(),
    fromName: `${firstName} ${lastName}`.trim(),
    fromPhone: primaryPhone || null,
    subject: `Adoption Application: ${interestedIn}`,
    bodyText:
      `New adoption application submitted for: ${interestedIn}.\n\n` +
      `Full application details are in the attached PDF. Download it from this message in the admin inbox.`,
    isRead: false,
    isReplied: false,
    receivedAt,
    repliedAt: null,
    applicationId,
    pdfKey,
    fencePhotoKeys: fencePhotoKeys && fencePhotoKeys.length > 0 ? fencePhotoKeys : null,
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return { messageId, threadId };
}

module.exports = { saveApplicationMessage };
