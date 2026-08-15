// donations-dynamo.js
// Writes a donation record for a recurring (subscription) charge, once
// PAYMENT.SALE.COMPLETED confirms money actually moved. Same `donations`
// table and shape as lambda/donate/dynamo.js's createDonationFromCapture
// -- duplicated here (not shared) following this project's existing
// per-Lambda file pattern, with `type` made a parameter instead of
// hardcoded 'one-time', and no campaignId support since recurring
// donations aren't tied to fundraisers in the current scope.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const DONATIONS_TABLE = process.env.DONATIONS_TABLE || 'donations';

async function createDonationFromCapture({ donorId, donorEmail, amount, currency, paypalTransactionId, type = 'recurring' }) {
  const now = new Date().toISOString();
  const item = {
    donationId: randomUUID(),
    donorId,
    donorEmail,
    amount,
    currency,
    type,
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

async function updateDonationReceipt(donationId, receiptUrl) {
  await ddb.send(new UpdateCommand({
    TableName: DONATIONS_TABLE,
    Key: { donationId },
    UpdateExpression: 'SET receiptUrl = :receiptUrl, receiptSentAt = :now, updatedAt = :now',
    ExpressionAttributeValues: { ':receiptUrl': receiptUrl, ':now': new Date().toISOString() },
  }));
}

module.exports = { createDonationFromCapture, updateDonationReceipt };
