/**
 * GET /api/surveys
 *
 * Get all surveys
 * Requires authentication
 */

const { withMiddleware, authenticateUser } = require('../../lib/middleware');
const { getDb } = require('../../lib/db');
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
    if (!database) {
      return sendServerError(res, 'Database not configured');
    }

    // Get the authenticated user's full data
    const user = await database.collection('users').findOne({ username: req.user.username });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Determine which surveys the user has access to
    let accessibleSurveys;

    if (user.role === 'admin') {
      // Admin users get full access to ALL active surveys
      accessibleSurveys = await database.collection('surveys')
        .find({ active: true })
        .sort({ country_id: 1, name: 1 })
        .toArray();
    } else {
      // Regular user - only their assigned surveys
      accessibleSurveys = await database.collection('surveys')
        .find({
          asset_id: { $in: user.permissions?.surveys || [] },
          active: true
        })
        .sort({ country_id: 1, name: 1 })
        .toArray();
    }

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

module.exports = withMiddleware(handler, authenticateUser);
