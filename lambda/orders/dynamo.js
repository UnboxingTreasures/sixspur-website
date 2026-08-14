// dynamo.js
// Shop order persistence + the atomic stock-reservation logic.
//
// RESERVATION MODEL (decided Aug 14, 2026 scoping session): stock is
// reserved (decremented) the moment checkout begins, NOT after PayPal
// capture -- this avoids ever charging someone for an item that just
// sold out from under them. All stock decrements for every cart line,
// PLUS creation of the new order record, happen inside a single
// DynamoDB TransactWriteItems call, so it's genuinely atomic: either
// every item in the cart gets reserved and the order is created, or
// NONE of it happens and nothing is touched anywhere. No manual
// rollback code, no partial-reservation states, no lock held while
// waiting on anything else (so no deadlock risk by construction).
//
// If the reservation fails (something sold out), the caller (index.js)
// simply never captures the PayPal order that was already created for
// this attempt -- an uncaptured PayPal order just expires on PayPal's
// side on its own; no charge ever happened, so there's nothing to
// refund.
//
// EXPIRY: reservations are released by a separate scheduled Lambda
// (lambda/expireOrderReservations) that scans for pending orders past
// their reservationExpiresAt and restocks + expires them. This file
// does not handle expiry itself.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient, GetCommand, UpdateCommand, TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
// removeUndefinedValues: non-variant cart lines don't have a
// comboIndex/variantValues -- rather than build two different shapes
// of line item by hand, this tells the SDK to just drop `undefined`
// fields when writing instead of throwing (its default behavior).
const ddb = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });

const ORDERS_TABLE = process.env.ORDERS_TABLE || 'orders';
const SHOP_ITEMS_TABLE = process.env.SHOP_ITEMS_TABLE || 'shop_items';

const RESERVATION_MINUTES = 15;
const SHIPPING_FLAT_RATE = Number(process.env.SHIPPING_FLAT_RATE || 7.5);

/**
 * Looks up each cart line's live product record and validates it,
 * computing the actual price and building the exact per-item transact
 * operation needed to reserve it. Throws with a specific, user-facing
 * message if a product/variant no longer exists -- this is a *separate*
 * failure mode from "out of stock" (which the transaction itself
 * catches), since a deleted product can't be conditionally decremented
 * at all.
 *
 * cartItems: [{ itemId, quantity, comboIndex? }]
 *   comboIndex is the index into that product's combinations[] array,
 *   as returned by the public shop detail fetch -- required when the
 *   product hasVariants, omitted otherwise.
 */
async function buildReservationPlan(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error('Cart is empty');
  }

  const transactItems = [];
  const orderLineItems = [];
  let subtotal = 0;

  for (const line of cartItems) {
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Invalid quantity for item ${line.itemId}`);
    }

    const product = (await ddb.send(new GetCommand({ TableName: SHOP_ITEMS_TABLE, Key: { itemId: line.itemId } }))).Item;
    if (!product) throw new Error(`Product no longer available: ${line.itemId}`);

    let unitPrice = product.price;
    let variantValues = null;

    if (product.hasVariants) {
      const comboIndex = Number(line.comboIndex);
      const combo = product.combinations?.[comboIndex];
      if (!Number.isInteger(comboIndex) || !combo) {
        throw new Error(`Invalid variant selection for ${product.name}`);
      }
      variantValues = combo.values;

      transactItems.push({
        Update: {
          TableName: SHOP_ITEMS_TABLE,
          Key: { itemId: product.itemId },
          UpdateExpression: `SET combinations[${comboIndex}].stock = combinations[${comboIndex}].stock - :qty`,
          ConditionExpression: `combinations[${comboIndex}].stock >= :qty`,
          ExpressionAttributeValues: { ':qty': quantity },
        },
      });
    } else {
      transactItems.push({
        Update: {
          TableName: SHOP_ITEMS_TABLE,
          Key: { itemId: product.itemId },
          UpdateExpression: 'SET stock = stock - :qty',
          ConditionExpression: 'stock >= :qty',
          ExpressionAttributeValues: { ':qty': quantity },
        },
      });
    }

    orderLineItems.push({
      itemId: product.itemId,
      name: product.name,
      unitPrice,
      quantity,
      comboIndex: product.hasVariants ? Number(line.comboIndex) : undefined,
      variantValues,
    });

    subtotal += unitPrice * quantity;
  }

  subtotal = Math.round(subtotal * 100) / 100;
  const shippingCost = SHIPPING_FLAT_RATE;
  const total = Math.round((subtotal + shippingCost) * 100) / 100;

  return { transactItems, orderLineItems, subtotal, shippingCost, total };
}

/**
 * Attempts to atomically reserve stock for every cart line AND create
 * the pending order record in one transaction. Returns the created
 * order on success. On failure, inspects which line(s) actually failed
 * their condition (out of stock) vs. a different error, so the caller
 * can show a specific, useful message instead of a generic "something
 * went wrong".
 */
async function reserveCartAndCreateOrder({ cartItems, donorId, email, shippingAddress, paypalOrderId }) {
  const { transactItems, orderLineItems, subtotal, shippingCost, total } = await buildReservationPlan(cartItems);

  const now = new Date();
  const orderId = randomUUID();
  const reservationExpiresAt = new Date(now.getTime() + RESERVATION_MINUTES * 60 * 1000).toISOString();

  const order = {
    orderId,
    donorId: donorId || null,
    email,
    shippingAddress,
    items: orderLineItems,
    subtotal,
    shippingCost,
    total,
    status: 'pending',
    paypalOrderId,
    reservationExpiresAt,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  transactItems.push({
    Put: {
      TableName: ORDERS_TABLE,
      Item: order,
      ConditionExpression: 'attribute_not_exists(orderId)',
    },
  });

  try {
    await ddb.send(new TransactWriteCommand({ TransactItems: transactItems }));
  } catch (err) {
    if (err.name === 'TransactionCanceledException') {
      // CancellationReasons is positional, same order as transactItems.
      // The last entry is always the order Put; everything before it is
      // a stock-decrement Update, one per cart line.
      const reasons = err.CancellationReasons || [];
      const failedLines = [];
      cartItems.forEach((line, i) => {
        if (reasons[i] && reasons[i].Code === 'ConditionalCheckFailed') {
          failedLines.push(line.itemId);
        }
      });
      const outOfStockError = new Error(
        failedLines.length > 0
          ? `Sorry, some items sold out while you were checking out: ${failedLines.join(', ')}`
          : 'Could not reserve your cart, please try again',
      );
      outOfStockError.code = 'OUT_OF_STOCK';
      outOfStockError.failedItemIds = failedLines;
      throw outOfStockError;
    }
    throw err;
  }

  return order;
}

async function getOrder(orderId) {
  const result = await ddb.send(new GetCommand({ TableName: ORDERS_TABLE, Key: { orderId } }));
  return result.Item || null;
}

/**
 * Flips a reserved order to paid after successful PayPal capture.
 * Conditional on still being 'pending' -- guards against a double
 * capture call (e.g. a retried request) re-processing the same order,
 * and against capturing an order the expiry Lambda already reclaimed.
 */
async function markOrderPaid(orderId, { paypalTransactionId }) {
  const now = new Date().toISOString();
  const result = await ddb.send(new UpdateCommand({
    TableName: ORDERS_TABLE,
    Key: { orderId },
    ConditionExpression: '#status = :pending',
    UpdateExpression: 'SET #status = :paid, paypalTransactionId = :txnId, paidAt = :now, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':pending': 'pending', ':paid': 'paid', ':txnId': paypalTransactionId, ':now': now },
    ReturnValues: 'ALL_NEW',
  })).catch((err) => {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  });

  return result ? result.Attributes : null;
}

module.exports = {
  buildReservationPlan, reserveCartAndCreateOrder, getOrder, markOrderPaid, SHIPPING_FLAT_RATE,
};
