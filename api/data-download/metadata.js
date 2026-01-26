/**
 * GET /api/data-download/metadata
 *
 * Unified endpoint returning all filter metadata in a single request:
 * - Countries (filtered by user permissions)
 * - Districts (filtered by user permissions and optional country)
 * - Surveys (filtered by user permissions and optional country)
 *
 * This replaces 3 separate endpoints (/api/countries, /api/districts, /api/surveys)
 * for data download use case, reducing HTTP requests and frontend complexity.
 *
 * @access Protected - Requires JWT authentication
 * @permission Filtered by user's country/survey/GAUL code permissions
 *
 * Query Parameters (all optional, snake_case format):
 * @queryparam {string} country_id - Filter districts and surveys by country code (case-insensitive)
 * @queryparam {string} survey_id - Filter districts by survey asset_id (cascade filtering)
 *
 * Response Format:
 * {
 *   countries: [{ code, name, active }],
 *   districts: [{ code, name, country_id, survey_label }],
 *   surveys: [{ asset_id, name, country_id, active }],
 *   user_context: { role, country, has_survey_restrictions, has_gaul_restrictions }
 * }
 *
 * @module api/data-download/metadata
 */

const { withMiddleware, authenticateUser } = require('../../lib/middleware');
const {
  getAccessibleCountries,
  getAccessibleDistricts,
  getAccessibleSurveys
} = require('../../lib/filter-permissions');
const {
  sendSuccess,
  sendServerError,
  setCorsHeaders
} = require('../../lib/response');

/**
 * Handler function for metadata endpoint
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
    // 1. Extract optional filters
    // Note: req.user is populated by authenticateUser middleware with full user data
    const { country_id, survey_id } = req.query;

    // 2. Fetch all metadata in parallel using shared utilities
    const [countries, districts, surveys] = await Promise.all([
      getAccessibleCountries(req.user),
      getAccessibleDistricts(req.user, country_id, survey_id), // Pass survey_id for cascade filtering
      getAccessibleSurveys(req.user, country_id)
    ]);

    // 3. Format response
    return sendSuccess(res, {
      countries: countries.map(c => ({
        code: c.code,
        name: c.name,
        active: c.active
      })),
      districts: districts.map(d => ({
        code: d.code,
        name: d.name,
        country_id: d.country_id,
        survey_label: d.survey_label
      })),
      surveys: surveys.map(s => ({
        asset_id: s.asset_id,
        name: s.name,
        country_id: s.country_id,
        active: s.active
      })),
      user_context: {
        role: req.user.role,
        country: req.user.country,
        has_survey_restrictions: req.user.permissions?.surveys && req.user.permissions.surveys.length > 0,
        has_gaul_restrictions: req.user.permissions?.gaul_codes && req.user.permissions.gaul_codes.length > 0
      }
    });

  } catch (error) {
    console.error('Metadata error:', error);
    return sendServerError(res, 'Failed to fetch filter metadata');
  }
}

module.exports = withMiddleware(handler, authenticateUser);
