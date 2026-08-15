// dynamo.js
// Admin CRUD for fundraisers. Lifecycle: create (draft), begin
// (draft/stopped -> active), stop (active -> stopped), archive
// (stopped -> archived, ONE-WAY). No delete -- same reasoning as
// donations, these are financial-adjacent records worth keeping an
// honest history of, not silently removing.
//
// Only one fundraiser is expected active at a time -- begin() enforces
// this by stopping any other currently-active fundraiser first, rather
// than allowing multiple simultaneous campaigns (matches the "create,
// begin, or stop A fundraiser" singular framing from scoping).
//
// ARCHIVE (added per Aug 14 2026 scoping): archiving is a terminal,
// one-way state -- a stopped fundraiser can be archived, but an
// archived fundraiser can NEVER be reopened or edited again, only
// viewed. Enforced here in the Lambda, not just hidden in the admin UI
// -- per the scoping notes, relying on the UI alone to hide the "Begin"
// option would leave the door open to any client bypassing it (a
// crafted API call, a stale cached page, etc.), so beginFundraiser()
// itself refuses to ever reactivate an archived record.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const FUNDRAISERS_TABLE = process.env.FUNDRAISERS_TABLE || 'fundraisers';
const DONATIONS_TABLE = process.env.DONATIONS_TABLE || 'donations';

function slugify(title) {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function listAll() {
  const result = await ddb.send(new ScanCommand({ TableName: FUNDRAISERS_TABLE }));
  const items = result.Items || [];

  // Live raised-so-far total per fundraiser, same calculation the
  // public endpoint uses -- admin should see real numbers too, not a
  // separately-maintained figure that could drift. Still computed for
  // archived fundraisers too -- an archived campaign's final total is
  // exactly the kind of thing the read-only archive view needs to show.
  for (const item of items) {
    item.raisedAmount = await getRaisedAmount(item.fundraiserId);
  }

  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getById(fundraiserId) {
  const result = await ddb.send(new GetCommand({ TableName: FUNDRAISERS_TABLE, Key: { fundraiserId } }));
  if (!result.Item) return null;
  result.Item.raisedAmount = await getRaisedAmount(fundraiserId);
  return result.Item;
}

async function getRaisedAmount(fundraiserId) {
  const result = await ddb.send(new ScanCommand({
    TableName: DONATIONS_TABLE,
    FilterExpression: 'campaignId = :campaignId AND #status = :completed',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':campaignId': fundraiserId, ':completed': 'completed' },
  }));
  return (result.Items || []).reduce((sum, d) => sum + Number(d.amount || 0), 0);
}

async function createFundraiser({ title, description, goalAmount, closingDate }) {
  if (!title || !title.trim()) throw new Error('Title is required');
  const numericGoal = Number(goalAmount);
  if (!Number.isFinite(numericGoal) || numericGoal <= 0) throw new Error('Goal amount must be a positive number');
  if (!closingDate) throw new Error('Closing date is required');

  const fundraiserId = slugify(title);
  if (!fundraiserId) throw new Error('Title must contain at least one letter or number');

  const existing = await getById(fundraiserId);
  if (existing) throw new Error(`A fundraiser with this title already exists (id: ${fundraiserId})`);

  const now = new Date().toISOString();
  const item = {
    fundraiserId,
    title: title.trim(),
    description: description ? description.trim() : '',
    goalAmount: numericGoal,
    closingDate,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(new PutCommand({
    TableName: FUNDRAISERS_TABLE,
    Item: item,
    ConditionExpression: 'attribute_not_exists(fundraiserId)',
  }));

  return item;
}

/**
 * Edits are blocked once a fundraiser is archived -- archived means
 * read-only, full stop, not just "can't be reactivated". Checked here
 * (not just left to the UI) for the same "don't trust the client alone"
 * reasoning as the archive lifecycle itself.
 */
async function updateFundraiser(fundraiserId, fields) {
  const existing = await getById(fundraiserId);
  if (!existing) return null;
  if (existing.status === 'archived') {
    throw new Error('This fundraiser is archived and can no longer be edited');
  }

  const updates = [];
  const values = { ':updatedAt': new Date().toISOString() };
  const names = {};

  if (fields.title !== undefined) {
    if (!fields.title.trim()) throw new Error('Title cannot be empty');
    updates.push('title = :title');
    values[':title'] = fields.title.trim();
  }
  if (fields.description !== undefined) {
    updates.push('description = :description');
    values[':description'] = fields.description.trim();
  }
  if (fields.goalAmount !== undefined) {
    const numericGoal = Number(fields.goalAmount);
    if (!Number.isFinite(numericGoal) || numericGoal <= 0) throw new Error('Goal amount must be a positive number');
    updates.push('goalAmount = :goalAmount');
    values[':goalAmount'] = numericGoal;
  }
  if (fields.closingDate !== undefined) {
    updates.push('closingDate = :closingDate');
    values[':closingDate'] = fields.closingDate;
  }
  updates.push('updatedAt = :updatedAt');

  const result = await ddb.send(new UpdateCommand({
    TableName: FUNDRAISERS_TABLE,
    Key: { fundraiserId },
    ConditionExpression: 'attribute_exists(fundraiserId)',
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeValues: values,
    ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
    ReturnValues: 'ALL_NEW',
  })).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  });

  return result ? result.Attributes : null;
}

/**
 * Starts this fundraiser (draft/stopped -> active). Stops any OTHER
 * currently-active fundraiser first -- enforces the one-at-a-time rule
 * at write time rather than just hoping the admin UI prevents it.
 *
 * REFUSES to reactivate an archived fundraiser -- this is the Lambda-
 * side half of the one-way archive door (the other half is the admin
 * UI simply never offering "Begin" on an archived card, see page.tsx).
 */
async function beginFundraiser(fundraiserId) {
  const target = await getById(fundraiserId);
  if (!target) return null;
  if (target.status === 'archived') {
    const err = new Error('This fundraiser is archived and cannot be reopened');
    err.code = 'ARCHIVED';
    throw err;
  }

  const allFundraisers = await ddb.send(new ScanCommand({ TableName: FUNDRAISERS_TABLE }));
  const now = new Date().toISOString();

  for (const item of allFundraisers.Items || []) {
    if (item.fundraiserId !== fundraiserId && item.status === 'active') {
      await ddb.send(new UpdateCommand({
        TableName: FUNDRAISERS_TABLE,
        Key: { fundraiserId: item.fundraiserId },
        UpdateExpression: 'SET #status = :stopped, updatedAt = :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':stopped': 'stopped', ':now': now },
      }));
    }
  }

  const result = await ddb.send(new UpdateCommand({
    TableName: FUNDRAISERS_TABLE,
    Key: { fundraiserId },
    UpdateExpression: 'SET #status = :active, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':active': 'active', ':now': now },
    ReturnValues: 'ALL_NEW',
  }));

  return result.Attributes;
}

async function stopFundraiser(fundraiserId) {
  const result = await ddb.send(new UpdateCommand({
    TableName: FUNDRAISERS_TABLE,
    Key: { fundraiserId },
    ConditionExpression: 'attribute_exists(fundraiserId)',
    UpdateExpression: 'SET #status = :stopped, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':stopped': 'stopped', ':now': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  })).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  });

  return result ? result.Attributes : null;
}

/**
 * Archives this fundraiser -- ONE-WAY, only allowed from 'stopped'.
 * ConditionExpression enforces both "exists" and "is currently
 * stopped" atomically, so this can't race with a concurrent begin/stop
 * call landing in between a check and this write.
 */
async function archiveFundraiser(fundraiserId) {
  const result = await ddb.send(new UpdateCommand({
    TableName: FUNDRAISERS_TABLE,
    Key: { fundraiserId },
    ConditionExpression: 'attribute_exists(fundraiserId) AND #status = :stopped',
    UpdateExpression: 'SET #status = :archived, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':stopped': 'stopped', ':archived': 'archived', ':now': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  })).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  });

  return result ? result.Attributes : null;
}

module.exports = {
  listAll, getById, createFundraiser, updateFundraiser, beginFundraiser, stopFundraiser, archiveFundraiser,
};
