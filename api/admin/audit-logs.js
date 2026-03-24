/**
 * GET /api/admin/audit-logs
 *
 * Return paginated audit log entries from the `users_audit` collection.
 * Requires authentication + admin role.
 *
 * Query parameters:
 *   page     {number}  Page number (default: 1)
 *   limit    {number}  Results per page (default: 50, max: 200)
 *   username {string}  Filter by username (case-insensitive substring)
 *   category {string}  Filter by category: auth | validation | download
 *   from     {string}  ISO date string — inclusive start of timestamp range
 *   to       {string}  ISO date string — inclusive end of timestamp range (full day)
 *
 * @access Protected — requires JWT authentication + admin role
 */

const { withMiddleware, authenticateUser, requireAdmin } = require('../../lib/middleware');
const { getDb } = require('../../lib/db');
const { setCorsHeaders, sendBadRequest, sendServerError, sendSuccess, sendMethodNotAllowed } = require('../../lib/response');
const { escapeRegex, isValidDate } = require('../../lib/helpers');

const SORTABLE_FIELDS = ['timestamp', 'username', 'category', 'action', 'status'];

async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  try {
    const database = await getDb();

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    // Validate date params before constructing Date objects
    if (req.query.from && !isValidDate(req.query.from)) {
      return sendBadRequest(res, 'Invalid "from" date format');
    }
    if (req.query.to && !isValidDate(req.query.to)) {
      return sendBadRequest(res, 'Invalid "to" date format');
    }

    // Build filter query
    const filter = {};

    if (req.query.username) {
      // Escape user input before using as regex to prevent ReDoS
      filter.username = { $regex: escapeRegex(req.query.username), $options: 'i' };
    }

    if (req.query.category && ['auth', 'validation', 'download'].includes(req.query.category)) {
      filter.category = req.query.category;
    }

    if (req.query.from || req.query.to) {
      filter.timestamp = {};
      if (req.query.from) {
        filter.timestamp.$gte = new Date(req.query.from);
      }
      if (req.query.to) {
        // Parse safely and advance to end-of-day UTC regardless of input format
        const toDate = new Date(req.query.to);
        toDate.setUTCHours(23, 59, 59, 999);
        filter.timestamp.$lte = toDate;
      }
    }

    const sortBy = SORTABLE_FIELDS.includes(req.query.sortBy) ? req.query.sortBy : 'timestamp';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const [logs, total] = await Promise.all([
      database.collection('users_audit')
        .find(filter, { projection: { user_agent: 0 } })
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .toArray(),
      database.collection('users_audit').countDocuments(filter)
    ]);

    return sendSuccess(res, { logs, total, page, limit });
  } catch (error) {
    return sendServerError(res, error);
  }
}

module.exports = withMiddleware(handler, authenticateUser, requireAdmin);
