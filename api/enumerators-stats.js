/**
 * GET /api/enumerators-stats
 *
 * Fetch enumerator statistics from MongoDB filtered by user permissions.
 * Supports per-survey loading — requires explicit survey selection when user
 * has access to multiple surveys (same pattern as /api/kobo/submissions).
 * Requires authentication.
 */

const { withMiddleware, authenticateUser } = require('../lib/middleware');
const { getDb } = require('../lib/db');
const { getEnumeratorStatsCollection } = require('../lib/helpers');
const { sendSuccess, sendServerError, sendMethodNotAllowed, setCorsHeaders } = require('../lib/response');

async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  try {
    const database = await getDb();
    if (!database) {
      return sendServerError(res, 'Database not configured');
    }

    const user = req.user;

    // Determine which surveys the user has access to
    let accessibleSurveys;

    if (user.role === 'admin' && (!user.permissions?.surveys || user.permissions.surveys.length === 0)) {
      accessibleSurveys = await database.collection('surveys')
        .find({ active: true })
        .toArray();
    } else {
      accessibleSurveys = await database.collection('surveys')
        .find({ asset_id: { $in: user.permissions?.surveys || [] }, active: true })
        .toArray();
    }

    if (accessibleSurveys.length === 0) {
      return sendSuccess(res, {
        count: 0,
        results: [],
        metadata: { accessible_surveys: [] }
      });
    }

    // Save full list before any filtering — always returned in metadata
    const allAccessibleSurveys = [...accessibleSurveys];

    const surveyIdFilter = req.query.survey_id;

    if (surveyIdFilter) {
      accessibleSurveys = allAccessibleSurveys.filter(s => s.asset_id === surveyIdFilter);

      if (accessibleSurveys.length === 0) {
        return sendSuccess(res, {
          count: 0,
          results: [],
          message: 'Survey not found or access denied',
          metadata: { accessible_surveys: allAccessibleSurveys.map(s => ({ asset_id: s.asset_id, name: s.name, country_id: s.country_id })) }
        });
      }
    } else if (accessibleSurveys.length > 1) {
      return sendSuccess(res, {
        count: 0,
        results: [],
        message: 'Please select a survey to view statistics',
        metadata: {
          accessible_surveys: allAccessibleSurveys.map(s => ({
            asset_id: s.asset_id,
            name: s.name,
            country_id: s.country_id
          }))
        }
      });
    }

    // Enumerator restrictions
    const allowedEnumerators = user.permissions?.enumerators || [];
    const hasEnumeratorRestrictions = allowedEnumerators.length > 0;

    const statsPromises = accessibleSurveys.map(async (survey) => {
      const collectionName = getEnumeratorStatsCollection(survey.asset_id);
      try {
        const filter = {
          type: { $ne: 'metadata' },
          ...(hasEnumeratorRestrictions && { submitted_by: { $in: allowedEnumerators } })
        };
        const stats = await database.collection(collectionName).find(filter).toArray();

        return stats.map(stat => ({
          ...stat,
          asset_id: survey.asset_id,
          survey_name: survey.name,
          survey_country: survey.country_id
        }));
      } catch (error) {
        console.error(`Error fetching stats for survey ${survey.asset_id}:`, error);
        return [];
      }
    });

    const allStats = await Promise.all(statsPromises);
    const results = allStats.flat();

    return sendSuccess(res, {
      count: results.length,
      results,
      metadata: {
        accessible_surveys: allAccessibleSurveys.map(s => ({
          asset_id: s.asset_id,
          name: s.name,
          country_id: s.country_id
        }))
      }
    });

  } catch (error) {
    console.error('Error in enumerators-stats handler:', error);
    return sendServerError(res, 'Failed to fetch enumerator statistics');
  }
}

module.exports = withMiddleware(handler, authenticateUser);
