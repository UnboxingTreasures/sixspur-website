// index.js
// Single Lambda behind API Gateway handling all news routes:
//   GET    /news                  (public: published only, ?category=)
//   GET    /news/{slug}           (public: published only, 404 on draft)
//   GET    /admin/news            (admin: all posts, any status)
//   GET    /admin/news/{slug}     (admin: single post, any status)
//   POST   /admin/news            (admin: create)
//   PATCH  /admin/news/{slug}     (admin: update, incl. publish/unpublish)
//   DELETE /admin/news/{slug}     (admin: delete)

const {
  listPublishedPosts,
  listAllPosts,
  getPublishedPost,
  getPostForAdmin,
  createPost,
  updatePost,
  deletePost,
} = require('./dynamo');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, {});
  }

  const routeKey = event.routeKey;
  const slug = event.pathParameters?.slug;
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
        return respond(200, post);
      }

      case 'DELETE /admin/news/{slug}': {
        await deletePost(slug);
        return respond(200, { success: true });
      }

      default:
        return respond(404, { error: `No handler for route: ${routeKey}` });
    }
  } catch (err) {
    console.error(`Error handling ${routeKey}:`, err);
    return respond(500, { error: 'Internal server error' });
  }
};
