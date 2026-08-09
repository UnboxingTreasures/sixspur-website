// dynamo.js
// Saves the adoption application into its own dedicated table
// (adoption_applications) rather than contact_messages, so it can carry a
// real status (Open / Under Review / Approved / Denied) and show up in the
// admin Adoptions page instead of the general Mail inbox.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.ADOPTION_APPLICATIONS_TABLE || 'adoption_applications';

async function saveApplication({ applicationId, firstName, lastName, primaryEmail, primaryPhone, secondaryEmail, secondaryPhone, interestedIn, pdfKey, fencePhotoKeys }) {
  const submittedAt = new Date().toISOString();

  const item = {
    applicationId,
    status: 'Open', // every new application starts here; admin moves it through the workflow
    submittedAt,
    statusUpdatedAt: submittedAt,
    firstName,
    lastName,
    primaryEmail: primaryEmail.trim().toLowerCase(),
    primaryPhone: primaryPhone || null,
    secondaryEmail: secondaryEmail ? secondaryEmail.trim().toLowerCase() : null,
    secondaryPhone: secondaryPhone || null,
    interestedIn,
    pdfKey,
    fencePhotoKeys: fencePhotoKeys && fencePhotoKeys.length > 0 ? fencePhotoKeys : null,
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return { applicationId };
}

module.exports = { saveApplication };
