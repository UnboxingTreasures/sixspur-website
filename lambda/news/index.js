// index.js
// Single Lambda behind API Gateway handling all news routes:
//   GET    /news                        (public: published only, ?category=)
//   GET    /news/{slug}                 (public: published only, 404 on draft)
//   GET    /admin/news                  (admin: all posts, any status)
//   GET    /admin/news/{slug}           (admin: single post, any status)
//   POST   /admin/news                  (admin: create)
//   PATCH  /admin/news/{slug}           (admin: update, incl. publish/unpublish)
//   DELETE /admin/news/{slug}           (admin: delete)
//   POST   /admin/news/photo/presign    (admin: presigned upload URL for the post image)
//
//   -- NEW Session 20, blog comments --
//   GET    /news/{slug}/comments        (public: non-deleted comments for a post)
//   POST   /news/{slug}/comments        (DONOR-ONLY: requires the standard Cognito
//                                         JWT authorizer attached directly at API
//                                         Gateway on THIS route, same as /donor/*
//                                         routes -- NOT gated via requireAdmin())
//   GET    /admin/news/comments         (admin: every comment, all posts, moderation)
//   DELETE /admin/news/comments/{id}    (admin: soft-delete one comment)
//
// AUTH: this Lambda is a MIXED public/admin/donor handler. The
// /admin/news* routes require requireAdmin() (JWT + isAdmin=true).
// POST /news/{slug}/comments requires a verified donor but NOT
// isAdmin -- that verification happens via API Gateway's JWT authorizer
// attached to that specific route (not requireAdmin(), which also
// checks isAdmin and would wrongly block a non-admin donor from
// commenting). Every other route stays fully public/open.

const {
  listPublishedPosts,
  listAllPosts,
  getPublishedPost,
  getPostForAdmin,
  createPost,
  updatePost,
  deletePost,
  createComment,
  listCommentsForPost,
  listAllCommentsForAdmin,
  softDeleteComment,
} = require('./dynamo');
const { createPresignedUploadUrl, deletePhotoSafely } = require('./s3');
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

const ADMIN_ROUTES = new Set([
  'GET /admin/news',
  'GET /admin/news/{slug}',
  'POST /admin/news',
  'PATCH /admin/news/{slug}',
  'DELETE /admin/news/{slug}',
  'POST /admin/news/photo/presign',
  'GET /admin/news/comments',
  'DELETE /admin/news/comments/{id}',
]);

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, {});
  }

  const routeKey = event.routeKey;

  if (ADMIN_ROUTES.has(routeKey)) {
    const auth = await requireAdmin(event);
    if (!auth.authorized) {
      return respond(auth.statusCode, { error: auth.error });
    }
  }

  const slug = event.pathParameters?.slug;
  const commentId = event.pathParameters?.id;
  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  try {
    switch (routeKey) {
      case 'GET /news': {
        const category = event.queryStringParameters?.category || null;
        const posts = await listPublishedPosts({ category });
        return respond(200, posts);
      }

      case 'GET /news/{slug}': {
        const post = await getPublishedPost(slug);
        if (!post) return respond(404, { error: 'Post not found' });
        return respond(200, post);
      }

      case 'GET /admin/news': {
        const posts = await listAllPosts();
        return respond(200, posts);
      }

      case 'GET /admin/news/{slug}': {
        const post = await getPostForAdmin(slug);
        if (!post) return respond(404, { error: 'Post not found' });
        return respond(200, post);
      }

      case 'POST /admin/news': {
        if (!body.title || !body.content) {
          return respond(400, { error: 'title and content are required' });
        }
        const post = await createPost(body);
        return respond(201, post);
      }

      case 'PATCH /admin/news/{slug}': {
        const existing = await getPostForAdmin(slug);
        if (!existing) return respond(404, { error: 'Post not found' });
        const post = await updatePost(slug, body);

        if (body.image && body.image !== existing.image) {
          await deletePhotoSafely(existing.image);
        }

        return respond(200, post);
      }

      case 'DELETE /admin/news/{slug}': {
        const existing = await getPostForAdmin(slug);
        await deletePost(slug);
        if (existing?.image) {
          await deletePhotoSafely(existing.image);
        }
        return respond(200, { success: true });
      }

      case 'POST /admin/news/photo/presign': {
        const fileName = body.fileName;
        if (!fileName) return respond(400, { error: 'fileName is required' });
        const { uploadUrl, cdnUrl } = await createPresignedUploadUrl(body.slugHint, fileName);
        return respond(200, { uploadUrl, cdnUrl });
      }

      // ── Blog comments (NEW Session 20) ──────────────────────────────

      case 'GET /news/{slug}/comments': {
        const comments = await listCommentsForPost(slug);
        return respond(200, { comments });
      }

      case 'POST /news/{slug}/comments': {
        // Donor identity comes from the JWT claims that API Gateway's
        // authorizer already verified on this route -- never from the
        // request body. Same defense-in-depth pattern as
        // lambda/donors/index.js's getVerifiedDonor.
        const claims = event.requestContext?.authorizer?.jwt?.claims;
        if (!claims?.sub) return respond(401, { error: 'Not authenticated' });

        try {
          const comment = await createComment({ slug, donorId: claims.sub, body: body.body });
          return respond(201, comment);
        } catch (err) {
          if (err.code === 'NO_NAME_SET') {
            return respond(400, { error: err.message, code: 'NO_NAME_SET' });
          }
          return respond(400, { error: err.message });
        }
      }

      case 'GET /admin/news/comments': {
        const comments = await listAllCommentsForAdmin();
        return respond(200, { comments });
      }

      case 'DELETE /admin/news/comments/{id}': {
        const updated = await softDeleteComment(commentId);
        if (!updated) return respond(404, { error: 'Comment not found' });
        return respond(200, updated);
      }

      default:
        return respond(404, { error: `No handler for route: ${routeKey}` });
    }
  } catch (err) {
    console.error(`Error handling ${routeKey}:`, err);
    return respond(500, { error: 'Internal server error' });
  }
};
