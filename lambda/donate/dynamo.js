// dynamo.js
// Writes the donation record after a successful PayPal capture. This is
// the PayPal-sourced counterpart to adminDonations' createManualDonation
// -- same table, same shape, different paymentMethod value.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const DONATIONS_TABLE = process.env.DONATIONS_TABLE || 'donations';

async function createDonationFromCapture({ donorId, donorEmail, amount, currency, paypalTransactionId }) {
  const now = new Date().toISOString();
  const item = {
    donationId: randomUUID(),
    donorId,
    donorEmail,
    amount,
    currency,
    type: 'one-time',
    status: 'completed',
    paymentMethod: 'paypal',
    paypalTransactionId,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(new PutCommand({ TableName: DONATIONS_TABLE, Item: item }));
  return item;
}

module.exports = { createDonationFromCapture };
