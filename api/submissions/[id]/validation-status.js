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

  try {
    // Get submission ID from query parameter (Vercel converts [id] to query.id)
    const id = req.query.id;
    const { validation_status, asset_id } = req.body;

    if (!asset_id) {
      return sendBadRequest(res, 'asset_id is required');
    }

    const database = await getDb();
    if (!database) {
      return sendServerError(res, 'Database not configured');
    }

    const collectionName = getSurveyFlagsCollection(asset_id);

    await database.collection(collectionName).updateOne(
      { submission_id: id },
      {
        $set: {
          validation_status,
          validated_at: new Date(),
          validated_by: req.user.username  // Track who made the update
        }
      },
      { upsert: true }
    );

    return res.json({
      success: true,
      message: `Validation status correctly updated for submission ${id}`
    });
  } catch (error) {
    console.error('Error updating validation status:', error);
    return sendServerError(res, 'Failed to update validation status');
  }
}

// Export with authentication middleware
module.exports = withMiddleware(handler, authenticateUser);
