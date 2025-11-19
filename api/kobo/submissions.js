/**
 * GET /api/kobo/submissions
 *
 * Fetch submissions from MongoDB filtered by user permissions
 * Supports multi-survey architecture and enumerator filtering
 * Requires authentication
 */

const { withMiddleware, authenticateUser } = require('../../lib/middleware');
const { getDb } = require('../../lib/db');
const { getSurveyFlagsCollection } = require('../../lib/helpers');
const { sendSuccess, sendUnauthorized, sendServerError, setCorsHeaders } = require('../../lib/response');

async function handler(req, res) {
  // Set CORS headers
  setCorsHeaders(res, req);

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET method
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
      return sendUnauthorized(res, 'User not found');
    }

    // Determine which surveys the user has access to
    let accessibleSurveys;

    if (user.role === 'admin') {
      // Admin users get full access to ALL active surveys, regardless of permissions.surveys
      accessibleSurveys = await database.collection('surveys')
        .find({ active: true })
        .toArray();
    } else {
      // Regular user - only their assigned surveys
      accessibleSurveys = await database.collection('surveys')
        .find({
          asset_id: { $in: user.permissions?.surveys || [] },
          active: true
        })
        .toArray();
    }

    if (accessibleSurveys.length === 0) {
      return res.json({
        count: 0,
        next: null,
        previous: null,
        results: []
      });
    }

    // Fetch submissions from MongoDB for each accessible survey
    // R pipeline now stores all data including validation_status, validated_at, validated_by
    const submissionsPromises = accessibleSurveys.map(async (survey) => {
      const collectionName = getSurveyFlagsCollection(survey.asset_id);

      try {
        // Fetch all submissions from MongoDB (R pipeline writes everything here)
        const mongoSubmissions = await database.collection(collectionName)
          .find({ type: { $ne: 'metadata' } })
          .toArray();

        return {
          asset_id: survey.asset_id,
          submissions: mongoSubmissions,
          survey_name: survey.name,
          survey_country: survey.country_id
        };
      } catch (error) {
        return {
          asset_id: survey.asset_id,
          submissions: [],
          survey_name: survey.name,
          survey_country: survey.country_id
        };
      }
    });

    const surveySubmissions = await Promise.all(submissionsPromises);

    // Determine if user has enumerator restrictions
    const allowedEnumerators = user.permissions?.enumerators || [];
    const hasEnumeratorRestrictions = allowedEnumerators.length > 0;

    // Process and combine all submissions from all accessible surveys
    let allSubmissions = [];
    let totalCount = 0;

    surveySubmissions.forEach(surveyData => {
      const processedSubmissions = surveyData.submissions
        .map(mongoDoc => {
          return {
            submission_id: mongoDoc.submission_id,
            submission_date: mongoDoc.submission_date,
            vessel_number: mongoDoc.vessel_number || '',
            catch_number: mongoDoc.catch_number || '',
            submitted_by: mongoDoc.submitted_by || '',
            validation_status: mongoDoc.validation_status || 'validation_status_on_hold',
            validated_at: mongoDoc.validated_at || mongoDoc.submission_date,
            validated_by: mongoDoc.validated_by || '',
            alert_flag: mongoDoc.alert_flag || '',
            alert_flags: mongoDoc.alert_flag ? mongoDoc.alert_flag.split(', ') : [],
            asset_id: surveyData.asset_id,
            survey_name: surveyData.survey_name || 'Unknown Survey',
            survey_country: surveyData.survey_country || ''
          };
        })
        .filter(submission => {
          // Apply enumerator filtering if user has restrictions
          if (hasEnumeratorRestrictions) {
            return allowedEnumerators.includes(submission.submitted_by);
          }
          return true; // No restrictions, include all
        });

      allSubmissions = [...allSubmissions, ...processedSubmissions];
      totalCount += processedSubmissions.length;
    });

    return res.json({
      count: totalCount,
      next: null,
      previous: null,
      results: allSubmissions,
      metadata: {
        accessible_surveys: accessibleSurveys.map(s => ({
          asset_id: s.asset_id,
          name: s.name,
          country_id: s.country_id
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching combined data:', error);
    return sendServerError(res, 'Failed to fetch submissions');
  }
}

// Export with authentication middleware
module.exports = withMiddleware(handler, authenticateUser);
