/**
 * PATCH /api/submissions/:id/validation_status
 *
 * Update validation status for a submission in MongoDB
 * Requires authentication
 */

const { withMiddleware, authenticateUser } = require('../../../lib/middleware');
const { getDb } = require('../../../lib/db');
const { getSurveyFlagsCollection, VALIDATION_STATUSES } = require('../../../lib/helpers');
const { getAccessibleSurveys } = require('../../../lib/filter-permissions');
const { sendBadRequest, sendForbidden, sendNotFound, sendServerError, setCorsHeaders } = require('../../../lib/response');
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

    // Shared with api/kobo/validation-status/[id].js so both write paths accept the same set.
    if (!VALIDATION_STATUSES.includes(validation_status)) {
      return sendBadRequest(res, 'Invalid validation_status value');
    }

    database = await getDb();

    // The asset_id names the collection that gets written to, so it must be one of the
    // surveys this user may touch — not merely a non-empty string. Without this check any
    // authenticated user could write into any survey, and an unrecognised value would create
    // a new `surveys_flags-*` collection on first upsert.
    const accessibleSurveys = await getAccessibleSurveys(req.user);
    if (!accessibleSurveys.some(s => s.asset_id === asset_id)) {
      return sendForbidden(res, 'You do not have access to the requested survey.');
    }

    const collectionName = getSurveyFlagsCollection(asset_id);

    // `submission_id` is written by the R pipeline as a NUMBER, but arrives here as a string
    // from the URL path, and MongoDB does not coerce across BSON types. Matching on the raw
    // string found nothing; combined with the old `upsert: true` that silently inserted a
    // throwaway string-keyed document instead of updating the real row, so portal status
    // changes never actually landed in Mongo. Match either representation.
    const numericId = /^\d+$/.test(id) ? Number(id) : null;
    const idFilter = numericId === null
      ? { submission_id: id }
      : { submission_id: { $in: [id, numericId] } };

    // No upsert: a submission the R pipeline has not written yet is a genuine 404, not a new
    // document keyed on nothing but a client-supplied submission_id.
    const before = await database.collection(collectionName).findOneAndUpdate(
      idFilter,
      {
        $set: {
          validation_status,
          validated_at: new Date(),
          validated_by: req.user.username
        }
      },
      { returnDocument: 'before' }
    );

    if (!before) {
      return sendNotFound(res, `Submission ${id} not found in the selected survey`);
    }

    const fromStatus = before.validation_status || null;

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
