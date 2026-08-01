// index.js
// Single Lambda behind API Gateway handling all admin inbox routes:
//   GET    /admin/inbox
//   GET    /admin/inbox/{id}
//   PATCH  /admin/inbox/{id}/read
//   PATCH  /admin/inbox/{id}/replied
//   POST   /admin/inbox/{id}/reply
//   POST   /admin/inbox/batch
//
// Ported from Unboxing Treasures admin inbox backend — order logic removed,
// adapted from MySQL to DynamoDB.

const {
  listMessages,
  getMessageWithThread,
  setReadStatus,
  markReplied,
  batchSetReadStatus,
} = require('./dynamo');
const { sendReply } = require('./ses');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function ok(data) {
  return respond(200, { success: true, data });
}

function fail(statusCode, message) {
  return respond(statusCode, { success: false, message });
}

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, {});
  }

  const routeKey = event.routeKey; // e.g. "GET /admin/inbox/{id}"
  const messageId = event.pathParameters?.id;
  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return fail(400, 'Invalid JSON body');
  }

  try {
    switch (routeKey) {
      case 'GET /admin/inbox': {
        const qs = event.queryStringParameters || {};
        const filter = qs.is_read === 'false' ? 'unread' : 'all';
        const search = qs.search || '';
        const page = parseInt(qs.page || '1', 10);

        const result = await listMessages({ filter, search, page });
        return ok(result);
      }

      case 'GET /admin/inbox/{id}': {
        const result = await getMessageWithThread(messageId);
        if (!result) return fail(404, 'Message not found');
        return ok(result);
      }

      case 'PATCH /admin/inbox/{id}/read': {
        await setReadStatus(messageId, Boolean(body.is_read));
        return ok({ messageId, isRead: Boolean(body.is_read) });
      }

      case 'PATCH /admin/inbox/{id}/replied': {
        await markReplied(messageId);
        return ok({ messageId, isReplied: true });
      }

      case 'POST /admin/inbox/{id}/reply': {
        const { to_email: toEmail, subject, reply_text: replyText } = body;
        if (!toEmail || !replyText) {
          return fail(400, 'to_email and reply_text are required');
        }
        await sendReply({ toEmail, subject, replyText });
        return ok({ sent: true });
      }

      case 'POST /admin/inbox/batch': {
        const { message_ids: messageIds, action } = body;
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
          return fail(400, 'message_ids must be a non-empty array');
        }
        if (action === 'mark_read') {
          await batchSetReadStatus(messageIds, true);
        } else if (action === 'mark_unread') {
          await batchSetReadStatus(messageIds, false);
        } else {
          return fail(400, `Unknown action: ${action}`);
        }
        return ok({ updated: messageIds.length });
      }

      default:
        return fail(404, `No handler for route: ${routeKey}`);
    }
  } catch (err) {
    console.error(`Error handling ${routeKey}:`, err);
    return fail(500, 'Internal server error');
  }
};
