// index.js
// Scheduled Lambda (EventBridge, run every few minutes -- same pattern
// as refreshFacebookToken's 30-day schedule, just a much shorter
// interval here since reservations only last 15 minutes). Not
// triggered by any API route; no HTTP handler shape.
//
// Finds every 'pending' shop order whose reservation window has
// expired and restocks its items, atomically per order (one
// TransactWriteItems per order: put every item's stock back + flip the
// order to 'expired', all-or-nothing, same reasoning as the reserve
// step in lambda/orders/dynamo.js). Runs as a plain scan+loop across
// orders, not a single giant transaction -- expired orders are
// independent of each other, no reason to couple their fates.
//
// Recommended EventBridge schedule: every 5 minutes
// (rate(5 minutes)) -- frequent enough that stock comes back quickly
// for the next shopper, infrequent enough to be cheap.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const ORDERS_TABLE = process.env.ORDERS_TABLE || 'orders';
const SHOP_ITEMS_TABLE = process.env.SHOP_ITEMS_TABLE || 'shop_items';

async function findExpiredPendingOrders() {
  const nowIso = new Date().toISOString();
  const result = await ddb.send(new ScanCommand({
    TableName: ORDERS_TABLE,
    FilterExpression: '#status = :pending AND reservationExpiresAt < :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':pending': 'pending', ':now': nowIso },
  }));
  return result.Items || [];
}

/**
 * Restocks every line item on one expired order and flips it to
 * 'expired', atomically. Conditional on the order still being
 * 'pending' -- guards against a race where the buyer's capture-order
 * call slipped in between our scan and this write; if that happens,
 * this transaction simply fails (order is no longer pending) and we
 * skip it, leaving the now-paid order and its stock decrement alone.
 */
async function restockOrder(order) {
  const transactItems = order.items.map((line) => {
    if (line.variantValues && Number.isInteger(line.comboIndex)) {
      return {
        Update: {
          TableName: SHOP_ITEMS_TABLE,
          Key: { itemId: line.itemId },
          UpdateExpression: `SET combinations[${line.comboIndex}].stock = combinations[${line.comboIndex}].stock + :qty`,
          ExpressionAttributeValues: { ':qty': line.quantity },
        },
      };
    }
    return {
      Update: {
        TableName: SHOP_ITEMS_TABLE,
        Key: { itemId: line.itemId },
        UpdateExpression: 'SET stock = stock + :qty',
        ExpressionAttributeValues: { ':qty': line.quantity },
      },
    };
  });

  transactItems.push({
    Update: {
      TableName: ORDERS_TABLE,
      Key: { orderId: order.orderId },
      ConditionExpression: '#status = :pending',
      UpdateExpression: 'SET #status = :expired, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':pending': 'pending', ':expired': 'expired', ':now': new Date().toISOString() },
    },
  });

  await ddb.send(new TransactWriteCommand({ TransactItems: transactItems }));
}

exports.handler = async () => {
  const expired = await findExpiredPendingOrders();
  console.log(`Found ${expired.length} expired pending order(s) to restock`);

  let restocked = 0;
  const failures = [];

  for (const order of expired) {
    try {
      await restockOrder(order);
      restocked += 1;
    } catch (err) {
      if (err.name === 'TransactionCanceledException') {
        // Most likely: the order got captured (paid) between our scan
        // and this write. Not an error -- just skip it, its stock
        // decrement is now legitimate and permanent.
        console.log(`Order ${order.orderId} no longer pending, skipping (likely captured mid-scan)`);
      } else {
        console.error(`Failed to restock order ${order.orderId}:`, err);
        failures.push(order.orderId);
      }
    }
  }

  console.log(`Restocked ${restocked} order(s), ${failures.length} failure(s)`);
  return { restocked, failures };
};
