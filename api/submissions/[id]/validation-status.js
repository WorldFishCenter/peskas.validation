/**
 * PATCH /api/submissions/:id/validation_status
 *
 * Update validation status for a submission in MongoDB
 * Requires authentication
 */

const { withMiddleware, authenticateUser } = require('../../../lib/middleware');
const { getDb } = require('../../../lib/db');
const { getSurveyFlagsCollection } = require('../../../lib/helpers');
const { sendBadRequest, sendServerError, setCorsHeaders } = require('../../../lib/response');
const { logAuditEvent } = require('../../../lib/audit-logger');

async function handler(req, res) {
  // Set CORS headers
  setCorsHeaders(res, req);

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow PATCH method
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let database;
  try {
    const id = req.query.id;
    const { validation_status, asset_id } = req.body;

    if (!asset_id) {
      return sendBadRequest(res, 'asset_id is required');
    }

    const VALID_STATUSES = ['validation_status_approved', 'validation_status_not_approved', 'validation_status_on_hold'];
    if (!validation_status || !VALID_STATUSES.includes(validation_status)) {
      return sendBadRequest(res, 'Invalid validation_status value');
    }

    database = await getDb();
    if (!database) {
      return sendServerError(res, 'Database not configured');
    }

    const collectionName = getSurveyFlagsCollection(asset_id);

    const before = await database.collection(collectionName).findOneAndUpdate(
      { submission_id: id },
      {
        $set: {
          validation_status,
          validated_at: new Date(),
          validated_by: req.user.username
        }
      },
      { upsert: true, returnDocument: 'before' }
    );
    const fromStatus = before?.validation_status || null;

    await logAuditEvent(database, {
      username: req.user.username,
      user_id: req.user.id,
      category: 'validation',
      action: 'validation_status_changed',
      status: 'success',
      details: { submission_id: id, survey_asset_id: asset_id, from_status: fromStatus, to_status: validation_status },
      req
    });

    return res.json({
      success: true,
      message: `Validation status correctly updated for submission ${id}`
    });
  } catch (error) {
    if (database) {
      logAuditEvent(database, {
        username: req.user?.username || null,
        user_id: req.user?.id || null,
        category: 'validation',
        action: 'validation_status_changed',
        status: 'failure',
        details: { submission_id: req.query.id, survey_asset_id: req.body?.asset_id || null },
        req
      }).catch(() => {});
    }
    console.error('Error updating validation status:', error);
    return sendServerError(res, 'Failed to update validation status');
  }
}

// Export with authentication middleware
module.exports = withMiddleware(handler, authenticateUser);
