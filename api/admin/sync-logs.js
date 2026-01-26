/**
 * GET /api/admin/sync-logs
 *
 * Fetch sync audit logs from MongoDB
 * Returns recent sync operations with results, errors, and timing info
 *
 * @access Protected - Requires admin authentication
 *
 * Query Parameters:
 * @queryparam {string} entity_type - Filter by entity type ('users', 'surveys', 'districts')
 * @queryparam {number} limit - Maximum number of logs to return (default: 50, max: 100)
 * @queryparam {number} skip - Number of logs to skip for pagination (default: 0)
 *
 * Response Format:
 * {
 *   logs: [{
 *     sync_id: string,
 *     entity_type: string,
 *     triggered_by: string,
 *     start_time: Date,
 *     end_time: Date,
 *     duration_ms: number,
 *     status: 'success' | 'failed' | 'partial',
 *     results: { created, updated, deleted, skipped, failed },
 *     errors: [{ message, stack, record_id, timestamp }]
 *   }],
 *   total: number,
 *   pagination: { limit, skip, has_more }
 * }
 *
 * @module api/admin/sync-logs
 */

const { withMiddleware, authenticateUser, requireAdmin } = require('../../lib/middleware');
const { getDb } = require('../../lib/db');
const { sendSuccess, sendServerError, setCorsHeaders } = require('../../lib/response');

/**
 * Handler function for sync logs endpoint
 */
async function handler(req, res) {
  setCorsHeaders(res, req);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse query parameters
    const {
      entity_type,
      limit = 50,
      skip = 0
    } = req.query;

    // Validate and sanitize parameters
    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100); // Between 1 and 100
    const skipNum = Math.max(parseInt(skip) || 0, 0); // Non-negative

    // Build query filter
    const filter = {};
    if (entity_type) {
      filter.entity_type = entity_type;
    }

    // Fetch logs from MongoDB
    const database = await getDb();
    const logsCollection = database.collection('sync_audit_log');

    // Get total count for pagination
    const total = await logsCollection.countDocuments(filter);

    // Fetch logs with pagination
    const logs = await logsCollection
      .find(filter)
      .sort({ start_time: -1 }) // Most recent first
      .skip(skipNum)
      .limit(limitNum)
      .toArray();

    // Calculate pagination info
    const hasMore = skipNum + logs.length < total;

    return sendSuccess(res, {
      logs: logs.map(log => ({
        sync_id: log.sync_id,
        entity_type: log.entity_type,
        triggered_by: log.triggered_by,
        start_time: log.start_time,
        end_time: log.end_time,
        duration_ms: log.duration_ms,
        status: log.status,
        results: log.results,
        errors: log.errors || [],
        airtable_snapshot: log.airtable_snapshot
      })),
      total,
      pagination: {
        limit: limitNum,
        skip: skipNum,
        has_more: hasMore,
        next_skip: hasMore ? skipNum + limitNum : null
      }
    });

  } catch (error) {
    console.error('Sync logs error:', error);
    return sendServerError(res, 'Failed to fetch sync logs');
  }
}

module.exports = withMiddleware(handler, authenticateUser, requireAdmin);
