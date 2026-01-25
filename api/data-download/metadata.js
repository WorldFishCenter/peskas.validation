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
 * Query Parameters:
 * - country_id (optional): Filter districts and surveys by country
 *
 * @module api/data-download/metadata
 */

const { withMiddleware, authenticateUser } = require('../../lib/middleware');
const { getDb } = require('../../lib/db');
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
    // 1. Fetch user from DB with permissions
    const database = await getDb();
    const user = await database.collection('users').findOne(
      { username: req.user.username },
      {
        projection: {
          username: 1,
          role: 1,
          country: 1,
          permissions: 1
        }
      }
    );

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // 2. Extract optional country filter
    const { country_id } = req.query;

    // 3. Fetch all metadata in parallel using shared utilities
    const [countries, districts, surveys] = await Promise.all([
      getAccessibleCountries(user),
      getAccessibleDistricts(user, country_id),
      getAccessibleSurveys(user, country_id)
    ]);

    // 4. Format response
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
        role: user.role,
        country: user.country,
        has_survey_restrictions: user.permissions?.surveys && user.permissions.surveys.length > 0,
        has_gaul_restrictions: user.permissions?.gaul_codes && user.permissions.gaul_codes.length > 0
      }
    });

  } catch (error) {
    console.error('Metadata error:', error);
    return sendServerError(res, 'Failed to fetch filter metadata');
  }
}

module.exports = withMiddleware(handler, authenticateUser);
