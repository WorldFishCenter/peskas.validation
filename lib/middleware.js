/**
 * The frame every `api/` handler runs inside.
 *
 * Production runs these handlers on Vercel; `server/dev.js` mounts the same functions under
 * Express. Both go through `withMiddleware`, so anything the frame owns is guaranteed to have
 * happened identically in dev and production before a handler sees the request.
 *
 * The frame owns, in order: CORS headers, the OPTIONS preflight, the method guard, the database
 * connection, authentication, the admin check, and the single error shape. A handler is left
 * with only its own logic.
 *
 * @module lib/middleware
 */

const { getDb } = require('./db');
const { verifyToken } = require('./jwt');
const { setCorsHeaders, HttpError } = require('./response');

/**
 * Load the authenticated user for this request.
 *
 * The JWT payload is deliberately not trusted for anything but identity: permissions are read
 * fresh from MongoDB on every request, so revoking a survey takes effect immediately rather
 * than when the user's 7-day token happens to expire.
 *
 * @param {Object} req - Request object, with `req.db` already attached
 * @returns {Promise<Object>} The user projection attached to `req.user`
 * @throws {HttpError} 401 for a missing, invalid, expired, unknown or disabled account
 */
async function loadUser(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HttpError('Authentication required', 401, 'AUTH_REQUIRED');
  }

  let decoded;
  try {
    decoded = verifyToken(authHeader.substring(7));
  } catch (error) {
    throw new HttpError(
      'Invalid authentication',
      401,
      error.message.includes('expired') ? 'TOKEN_EXPIRED' : 'AUTH_INVALID'
    );
  }

  const user = await req.db.collection('users').findOne(
    { username: decoded.username },
    { projection: { password_hash: 0 } }
  );

  if (!user) {
    throw new HttpError('User not found', 401, 'USER_NOT_FOUND');
  }

  // Login refuses disabled accounts, but tokens live for 7 days — without this check,
  // deactivating a user left their existing token working for the rest of its lifetime.
  if (!user.active) {
    throw new HttpError('Account is disabled', 401, 'ACCOUNT_DISABLED');
  }

  return {
    id: user._id.toString(),
    username: user.username,
    role: user.role,
    country: user.country, // Needed by data download endpoints
    permissions: user.permissions // Fresh permissions (not stale from JWT)
  };
}

/**
 * Wrap a handler in the frame.
 *
 * A handler may do either of two things, and the frame stays out of the way of the second:
 *
 *   - **return a value** — sent as 200 JSON, verbatim. Success payload shapes are the
 *     handler's business; the frame does not wrap or rename anything.
 *   - **write to `res` itself and return nothing** — for CSV streams and endpoints setting
 *     their own headers. Once `res.headersSent` is true the frame does not touch the response.
 *
 * To fail, throw. An error carrying a numeric `statusCode` (`HttpError`,
 * `DownloadPermissionError`) is reported at that status as `{ error, code? }`. Anything else
 * is logged in full and reported as a generic 500, so an internal message never reaches a user.
 *
 * @param {Function} handler - `async (req, res) => value | void`
 * @param {Object} [options]
 * @param {string[]} [options.methods] - Allowed HTTP methods (default: `['GET']`)
 * @param {boolean} [options.auth] - Require a valid token (default: `true`)
 * @param {boolean} [options.admin] - Require `role === 'admin'` (implies `auth`)
 * @returns {Function} Handler suitable for both Vercel and `server/dev.js`
 */
function withMiddleware(handler, options = {}) {
  const { methods = ['GET'], auth = true, admin = false } = options;

  return async (req, res) => {
    // Before anything that can fail: a 401 without CORS headers is unreadable to the browser,
    // which used to turn every expired token into an opaque network error cross-origin.
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (!methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '));
      return res.status(405).json({
        error: `Method not allowed. Allowed methods: ${methods.join(', ')}`
      });
    }

    try {
      req.db = await getDb();

      if (auth || admin) {
        req.user = await loadUser(req);
      }

      if (admin && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const result = await handler(req, res);

      // The handler took charge of the response (CSV stream, custom headers, redirect).
      if (res.headersSent) return;

      return res.json(result);
    } catch (error) {
      const status = Number(error?.statusCode);
      const isClientError = Number.isInteger(status) && status >= 400 && status < 600;

      console.error(`${req.method} ${req.url} failed:`, error);

      if (res.headersSent) return;

      if (isClientError) {
        const body = { error: error.message };
        if (error.code) body.code = error.code;
        return res.status(status).json(body);
      }

      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

module.exports = {
  withMiddleware
};
