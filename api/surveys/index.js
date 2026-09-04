/**
 * GET /api/surveys
 *
 * Get all surveys
 * Requires authentication
 */

const { withMiddleware } = require('../../lib/middleware');
const { getAccessibleSurveys } = require('../../lib/filter-permissions');
const { sendServerError } = require('../../lib/response');

async function handler(req, res) {
  try {
    // Single source of truth for the permission rule. This endpoint used to grant every
    // active survey on `role === 'admin'` alone, which disagreed with the documented model
    // (admin with a populated permissions.surveys is limited to that list) and with every
    // other endpoint.
    const accessibleSurveys = await getAccessibleSurveys(req.db, req.user);

    return res.json({
      success: true,
      surveys: accessibleSurveys.map(survey => ({
        _id: survey._id.toString(),
        asset_id: survey.asset_id,
        name: survey.name,
        country_id: survey.country_id,
        active: survey.active,
        description: survey.description
      }))
    });
  } catch (error) {
    console.error('Get surveys error:', error);
    return sendServerError(res, 'Failed to get surveys');
  }
}

module.exports = withMiddleware(handler, { methods: ['GET'] });
