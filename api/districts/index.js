/**
 * GET /api/districts
 *
 * Get all districts from MongoDB (replaces Airtable dependency)
 * Requires authentication
 * Applies permission filtering (GAUL codes)
 *
 * Query Parameters:
 * - country_id (optional): Filter by country
 */

const { withMiddleware, authenticateUser } = require('../../lib/middleware');
const { getDb } = require('../../lib/db');
const { getAccessibleDistricts } = require('../../lib/filter-permissions');
const { sendServerError, setCorsHeaders } = require('../../lib/response');

async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const database = await getDb();

    // Get the authenticated user's full data
    const user = await database.collection('users').findOne({
      username: req.user.username
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Extract optional country filter
    const { country_id } = req.query;

    // Use shared utility for permission filtering
    const districts = await getAccessibleDistricts(user, country_id);

    return res.json({
      success: true,
      districts: districts.map(d => ({
        code: d.code,
        name: d.name,
        country_id: d.country_id,
        survey_label: d.survey_label,
        active: d.active
      }))
    });
  } catch (error) {
    console.error('Get districts error:', error);
    return sendServerError(res, 'Failed to get districts');
  }
}

module.exports = withMiddleware(handler, authenticateUser);
