// index.js
// Single Lambda behind API Gateway handling all admin inbox routes:
//   GET    /admin/inbox
//   GET    /admin/inbox/{id}
//   PATCH  /admin/inbox/{id}/read
//   PATCH  /admin/inbox/{id}/replied
//   PATCH  /admin/inbox/{id}/restore
//   DELETE /admin/inbox/{id}
//   POST   /admin/inbox/{id}/reply
//   POST   /admin/inbox/batch
//
// Ported from Unboxing Treasures admin inbox backend — order logic removed,
// adapted from MySQL to DynamoDB.
//
// AUTH: every route here requires a verified JWT (via the same
// authorizer protecting /donor/* and /donate/*) AND isAdmin=true on
// the donor record -- see requireAdmin() in adminAuth.js. Auth failures
// go through fail() (not a raw respond()) so they match this Lambda's
// existing { success: false, message } response shape the frontend
// already expects.

const {
  listMessages,
  getMessageWithThread,
  getThreadId,
  getThreadAndEmailMessageId,
  saveOutboundReply,
  setReadStatus,
  markReplied,
  batchSetReadStatus,
  setDeletedStatus,
  batchSetDeletedStatus,
  setThreadDeletedStatus,
  setThreadReadStatus,
} = require('./dynamo');
const { sendReply } = require('./ses');
const { requireAdmin } = require('./adminAuth');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
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

  const auth = await requireAdmin(event);
  if (!auth.authorized) {
    return fail(auth.statusCode, auth.error);
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
        const includeDeleted = qs.include_deleted === 'true';

        const result = await listMessages({ filter, search, page, includeDeleted });
        return ok(result);
      }

      case 'GET /admin/inbox/{id}': {
        const result = await getMessageWithThread(messageId);
        if (!result) return fail(404, 'Message not found');
        return ok(result);
      }

      case 'PATCH /admin/inbox/{id}/read': {
        await setThreadReadStatus(messageId, Boolean(body.is_read));
        return ok({ messageId, isRead: Boolean(body.is_read) });
      }

      case 'PATCH /admin/inbox/{id}/replied': {
        await markReplied(messageId);
        return ok({ messageId, isReplied: true });
      }

      case 'DELETE /admin/inbox/{id}': {
        await setThreadDeletedStatus(messageId, true);
        return ok({ messageId, isDeleted: true });
      }

      // Not yet wired into any UI -- the backend half of "restore" so it's
      // ready to go whenever that gets built, without needing another
      // round of Lambda/API Gateway changes first.
      case 'PATCH /admin/inbox/{id}/restore': {
        await setThreadDeletedStatus(messageId, false);
        return ok({ messageId, isDeleted: false });
      }

      case 'POST /admin/inbox/{id}/reply': {
        const { to_email: toEmail, subject, reply_text: replyText } = body;
        if (!toEmail || !replyText) {
          return fail(400, 'to_email and reply_text are required');
        }

        const threadInfo = await getThreadAndEmailMessageId(messageId);
        const inReplyToEmailMessageId = threadInfo?.emailMessageId || null;

        const { emailMessageId: newEmailMessageId, subject: sentSubject } = await sendReply({
          toEmail,
          subject,
          replyText,
          inReplyToEmailMessageId,
        });

        // The email has now actually been sent. Saving it as a thread
        // message is a nice-to-have for the Conversation Thread view, not
        // something the person waiting on a response should ever see as a
        // failure -- so a problem here is logged, not thrown. Otherwise a
        // successfully-sent reply would incorrectly show as an error,
        // risking Richard re-sending a reply that already went out fine.
        try {
          if (threadInfo?.threadId) {
            await saveOutboundReply({
              threadId: threadInfo.threadId,
              subject: sentSubject,
              bodyText: replyText,
              emailMessageId: newEmailMessageId,
              inReplyTo: inReplyToEmailMessageId,
            });
          }
        } catch (err) {
          console.error('Reply email sent successfully, but failed to save it to the thread:', err);
        }

        return ok({ sent: true });
      }

      case 'POST /admin/inbox/batch': {
        const { message_ids: messageIds, action } = body;
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
          return fail(400, 'message_ids must be a non-empty array');
        }
        if (action === 'mark_read') {
          await Promise.all(messageIds.map((id) => setThreadReadStatus(id, true)));
        } else if (action === 'mark_unread') {
          await Promise.all(messageIds.map((id) => setThreadReadStatus(id, false)));
        } else if (action === 'delete') {
          await Promise.all(messageIds.map((id) => setThreadDeletedStatus(id, true)));
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
