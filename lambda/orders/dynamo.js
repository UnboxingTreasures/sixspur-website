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
  DynamoDBDocumentClient, GetCommand, UpdateCommand, TransactWriteCommand, QueryCommand,
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
/**
 * Looks up each cart line's live product record and validates it,
 * computing the actual price and building the exact per-PRODUCT
 * transact operations needed to reserve everything.
 *
 * IMPORTANT: operations are grouped per-product (per itemId), not
 * per-cart-line. DynamoDB's TransactWriteItems REJECTS a transaction
 * that contains more than one operation against the same item (same
 * table + key) -- even if those operations touch different elements
 * inside it. A variant product stores every combination's stock inside
 * ONE row (combinations[]), so two different sizes/colors of the SAME
 * product in the cart would otherwise generate two separate Update
 * operations against that identical row, and DynamoDB would reject the
 * whole transaction with "Transaction request cannot include multiple
 * operations on one item". Surfaced by actually testing checkout with
 * two variants of the same product in the cart, not caught in review.
 * Fix: collapse every cart line for a given product into ONE Update,
 * with one SET clause per combo index and all their conditions ANDed
 * together, so DynamoDB sees exactly one operation per item no matter
 * how many of that product's variants are in the cart.
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

  // Defensive merge: sum quantities for any duplicate (itemId,
  // comboIndex) lines. The frontend cart already prevents duplicates,
  // but the backend shouldn't assume that -- and this also means the
  // per-product grouping below never has to worry about the same combo
  // index appearing twice within one product's decrement.
  const mergedByKey = new Map();
  for (const line of cartItems) {
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Invalid quantity for item ${line.itemId}`);
    }
    const key = `${line.itemId}::${line.comboIndex ?? ''}`;
    const existing = mergedByKey.get(key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      mergedByKey.set(key, { itemId: line.itemId, comboIndex: line.comboIndex, quantity });
    }
  }
  const mergedLines = Array.from(mergedByKey.values());

  // Fetch each distinct product once, even if it appears via multiple
  // variant lines.
  const productIds = Array.from(new Set(mergedLines.map((l) => l.itemId)));
  const products = {};
  for (const id of productIds) {
    const product = (await ddb.send(new GetCommand({ TableName: SHOP_ITEMS_TABLE, Key: { itemId: id } }))).Item;
    if (!product) throw new Error(`Product no longer available: ${id}`);
    products[id] = product;
  }

  // decrementsByProduct groups every cart line by itemId so each
  // product becomes exactly one transact operation, per the DynamoDB
  // constraint explained above.
  const decrementsByProduct = {};
  const orderLineItems = [];
  let subtotal = 0;

  for (const line of mergedLines) {
    const product = products[line.itemId];
    const unitPrice = product.price;
    let variantValues = null;

    if (product.hasVariants) {
      const comboIndex = Number(line.comboIndex);
      const combo = product.combinations?.[comboIndex];
      if (!Number.isInteger(comboIndex) || !combo) {
        throw new Error(`Invalid variant selection for ${product.name}`);
      }
      variantValues = combo.values;
      decrementsByProduct[line.itemId] = decrementsByProduct[line.itemId] || { hasVariants: true, combos: [] };
      decrementsByProduct[line.itemId].combos.push({ comboIndex, quantity: line.quantity });
    } else {
      decrementsByProduct[line.itemId] = { hasVariants: false, quantity: line.quantity };
    }

    orderLineItems.push({
      itemId: product.itemId,
      name: product.name,
      unitPrice,
      quantity: line.quantity,
      comboIndex: product.hasVariants ? Number(line.comboIndex) : undefined,
      variantValues,
    });

    subtotal += unitPrice * line.quantity;
  }

  // Build exactly one TransactWriteItems Update per product.
  // productOrder tracks which itemId each transactItems[i] belongs to,
  // in the same order -- needed later to translate a
  // TransactionCanceledException's per-operation CancellationReasons
  // back into "which product(s) actually sold out" for the buyer.
  const transactItems = [];
  const productOrder = [];

  for (const [itemId, decrement] of Object.entries(decrementsByProduct)) {
    productOrder.push(itemId);

    if (decrement.hasVariants) {
      const setClauses = [];
      const condClauses = [];
      const values = {};
      decrement.combos.forEach(({ comboIndex, quantity }, i) => {
        setClauses.push(`combinations[${comboIndex}].stock = combinations[${comboIndex}].stock - :qty${i}`);
        condClauses.push(`combinations[${comboIndex}].stock >= :qty${i}`);
        values[`:qty${i}`] = quantity;
      });
      transactItems.push({
        Update: {
          TableName: SHOP_ITEMS_TABLE,
          Key: { itemId },
          UpdateExpression: `SET ${setClauses.join(', ')}`,
          ConditionExpression: condClauses.join(' AND '),
          ExpressionAttributeValues: values,
        },
      });
    } else {
      transactItems.push({
        Update: {
          TableName: SHOP_ITEMS_TABLE,
          Key: { itemId },
          UpdateExpression: 'SET stock = stock - :qty',
          ConditionExpression: 'stock >= :qty',
          ExpressionAttributeValues: { ':qty': decrement.quantity },
        },
      });
    }
  }

  subtotal = Math.round(subtotal * 100) / 100;
  const shippingCost = SHIPPING_FLAT_RATE;
  const total = Math.round((subtotal + shippingCost) * 100) / 100;

  return {
    transactItems, productOrder, orderLineItems, subtotal, shippingCost, total,
  };
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
  const {
    transactItems, productOrder, orderLineItems, subtotal, shippingCost, total,
  } = await buildReservationPlan(cartItems);

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
      // Since transactItems is now grouped PER PRODUCT (see
      // buildReservationPlan), reasons[i] corresponds to productOrder[i]
      // -- one entry per distinct product in the cart, not one per cart
      // line. The last entry is always the order Put.
      const reasons = err.CancellationReasons || [];
      const failedItemIds = [];
      productOrder.forEach((itemId, i) => {
        if (reasons[i] && reasons[i].Code === 'ConditionalCheckFailed') {
          failedItemIds.push(itemId);
        }
      });
      const outOfStockError = new Error(
        failedItemIds.length > 0
          ? `Sorry, some items sold out while you were checking out: ${failedItemIds.join(', ')}`
          : 'Could not reserve your cart, please try again',
      );
      outOfStockError.code = 'OUT_OF_STOCK';
      outOfStockError.failedItemIds = failedItemIds;
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
 * Order history for the account page -- queries the donorId-index GSI
 * rather than scanning the whole table. Guest orders (donorId stored as
 * a real NULL type, not a string) are automatically excluded from this
 * index by DynamoDB itself, so this can never accidentally leak a
 * guest's order into someone else's history. Sorted newest-first for
 * display, same convention as donation history.
 */
async function getOrdersByDonor(donorId) {
  const result = await ddb.send(new QueryCommand({
    TableName: ORDERS_TABLE,
    IndexName: 'donorId-index',
    KeyConditionExpression: 'donorId = :donorId',
    ExpressionAttributeValues: { ':donorId': donorId },
  }));
  return (result.Items || []).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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
  buildReservationPlan, reserveCartAndCreateOrder, getOrder, getOrdersByDonor, markOrderPaid, SHIPPING_FLAT_RATE,
};
