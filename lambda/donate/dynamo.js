// dynamo.js
// Writes the donation record after a successful PayPal capture. This is
// the PayPal-sourced counterpart to adminDonations' createManualDonation
// (removed) -- same table, same shape, different paymentMethod value.
//
// UPDATED for Fundraiser (Session 13): accepts an optional campaignId --
// when a donation comes from a fundraiser's donate button rather than
// the general Give Once flow, it gets tagged so the fundraiser's
// thermometer total includes it.
//
// UPDATED again same session: also denormalizes the fundraiser's title
// onto the donation record as campaignTitle, captured at donation time --
// this keeps donor/admin history accurate to what the campaign was
// actually called when the gift was given, even if it gets renamed or
// edited later. Looked up once here rather than resolved at display
// time on every page load.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const DONATIONS_TABLE = process.env.DONATIONS_TABLE || 'donations';
const FUNDRAISERS_TABLE = process.env.FUNDRAISERS_TABLE || 'fundraisers';

async function getFundraiserTitle(campaignId) {
  if (!campaignId) return null;
  const result = await ddb.send(new GetCommand({ TableName: FUNDRAISERS_TABLE, Key: { fundraiserId: campaignId } }));
  return result.Item?.title || null;
}

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
  // before for general (non-fundraiser) donations, no new fields
  // cluttering every record that doesn't need them.
  if (campaignId) {
    item.campaignId = campaignId;
    const title = await getFundraiserTitle(campaignId);
    if (title) item.campaignTitle = title;
  }

  await ddb.send(new PutCommand({ TableName: DONATIONS_TABLE, Item: item }));
  return item;
}

module.exports = { createDonationFromCapture };
