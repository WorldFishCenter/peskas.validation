/**
 * GET /api/users/:id/accessible-surveys
 *
 * Get surveys accessible to a specific user
 * Users can view their own, admins can view any
 * Requires authentication
 */

const { withMiddleware } = require('../../../lib/middleware');
const { validateObjectId } = require('../../../lib/helpers');
const { getAccessibleSurveys, normalizeCountryCode } = require('../../../lib/filter-permissions');
const { sendNotFound, sendForbidden, sendServerError } = require('../../../lib/response');

async function handler(req, res) {
  try {
    // Get user ID from query parameter (Vercel converts [id] to query.id)
    const id = req.query.id;

    // Validate ObjectId before using it
    const userId = validateObjectId(id, 'User ID');

    const database = req.db;
    // Check if requesting user has permission to view this
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return sendForbidden(res, 'Access denied');
    }

    const user = await database.collection('users').findOne({ _id: userId });

    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    // Resolved for the *target* user, not the caller. Sorting previously used
    // `country_code`, a field that does not exist on survey documents, so it was a no-op.
    const surveys = await getAccessibleSurveys(req.db, user);

    return res.json({
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role
      },
      surveys: surveys.map(survey => ({
        id: survey._id.toString(),
        asset_id: survey.asset_id,
        name: survey.name,
        country_code: normalizeCountryCode(survey.country_id),
        active: survey.active,
        description: survey.description
      }))
    });
  } catch (error) {
    console.error('Get accessible surveys error:', error);

    // Return 400 for validation errors
    return sendServerError(res, 'Failed to get accessible surveys');
  }
}

module.exports = withMiddleware(handler, { methods: ['GET'] });
