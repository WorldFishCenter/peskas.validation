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

    const surveys = await database.collection('surveys')
      .find({})
      .sort({ country_id: 1, name: 1 })
      .toArray();

    return res.json(surveys.map(survey => ({
      _id: survey._id.toString(),
      asset_id: survey.asset_id,
      name: survey.name,
      country_id: survey.country_id,
      active: survey.active,
      description: survey.description,
      kobo_config: survey.kobo_config
    })));
  } catch (error) {
    console.error('Get surveys error:', error);
    return sendServerError(res, 'Failed to get surveys');
  }
}

module.exports = withMiddleware(handler, authenticateUser);
