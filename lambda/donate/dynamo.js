// dynamo.js
// Writes the donation record after a successful PayPal capture. This is
// the PayPal-sourced counterpart to adminDonations' createManualDonation
// (removed) -- same table, same shape, different paymentMethod value.
//
// UPDATED for Fundraiser (Session 13): accepts an optional campaignId --
// when a donation comes from a fundraiser's donate button rather than
// the general Give Once flow, it gets tagged so the fundraiser's
// thermometer total includes it.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const DONATIONS_TABLE = process.env.DONATIONS_TABLE || 'donations';

async function createDonationFromCapture({ donorId, donorEmail, amount, currency, paypalTransactionId, campaignId }) {
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

  // Only stored when present -- keeps the item shape identical to
  // before for general (non-fundraiser) donations, no new field
  // cluttering every record that doesn't need it.
  if (campaignId) {
    item.campaignId = campaignId;
  }

  await ddb.send(new PutCommand({ TableName: DONATIONS_TABLE, Item: item }));
  return item;
}

module.exports = { createDonationFromCapture };
