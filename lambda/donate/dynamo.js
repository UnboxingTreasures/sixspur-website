// dynamo.js
// Writes the donation record after a successful PayPal capture. This is
// the PayPal-sourced counterpart to adminDonations' createManualDonation
// (removed) -- same table, same shape, different paymentMethod value.
//
// UPDATED for Fundraiser (Session 13): accepts an optional campaignId --
// when a donation comes from a fundraiser's donate button rather than
// the general Give Once flow, it gets tagged so the fundraiser's
// thermometer total includes it. Also denormalizes the fundraiser's
// title onto the donation record as campaignTitle, captured at donation
// time -- keeps donor/admin history accurate to what the campaign was
// actually called when the gift was given, even if it's renamed later.
//
// FIXED same session: receiptUrl was only ever set on the in-memory
// object returned in the API response, never actually written back to
// the database -- meant the very first page load after donating showed
// the download link correctly (it was in the live response), but any
// LATER load queried the database fresh and found it still empty. Real
// bug, not a display issue -- confirmed by checking the raw table
// (receiptUrl: null) despite the receipt email having arrived with a
// working link, proving generation succeeded but never got persisted.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
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

  if (campaignId) {
    item.campaignId = campaignId;
    const title = await getFundraiserTitle(campaignId);
    if (title) item.campaignTitle = title;
  }

  await ddb.send(new PutCommand({ TableName: DONATIONS_TABLE, Item: item }));
  return item;
}

/**
 * Persists the receipt URL onto the actual database record after
 * successful generation -- this is the piece that was missing before.
 * Called separately from createDonationFromCapture since the donation
 * needs to exist (and have a donationId) before a receipt referencing
 * it can be built.
 */
async function updateDonationReceipt(donationId, receiptUrl) {
  await ddb.send(new UpdateCommand({
    TableName: DONATIONS_TABLE,
    Key: { donationId },
    UpdateExpression: 'SET receiptUrl = :receiptUrl, receiptSentAt = :now, updatedAt = :now',
    ExpressionAttributeValues: { ':receiptUrl': receiptUrl, ':now': new Date().toISOString() },
  }));
}

module.exports = { createDonationFromCapture, updateDonationReceipt };
