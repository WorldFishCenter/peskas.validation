/**
 * GET /api/kobo/submissions
 *
 * Fetch submissions from MongoDB filtered by user permissions.
 * Supports multi-survey architecture with explicit survey selection.
 * Requires authentication.
 */

const { withMiddleware, authenticateUser } = require('../../lib/middleware');
const { getDb } = require('../../lib/db');
const { getSurveyFlagsCollection } = require('../../lib/helpers');
const { sendSuccess, sendServerError, sendMethodNotAllowed, setCorsHeaders } = require('../../lib/response');

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

    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000;
    const skip = (page - 1) * limit;

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
        next: null,
        previous: null,
        results: [],
        page,
        limit,
        metadata: { accessible_surveys: [] }
      });
    }

    // Save full list before any filtering — always returned in metadata so the
    // frontend can populate the survey selector regardless of which survey is loaded
    const allAccessibleSurveys = [...accessibleSurveys];

    const surveyIdFilter = req.query.survey_id;

    if (surveyIdFilter) {
      // User selected a specific survey - filter to just that one
      accessibleSurveys = allAccessibleSurveys.filter(s => s.asset_id === surveyIdFilter);

      if (accessibleSurveys.length === 0) {
        return sendSuccess(res, {
          count: 0,
          next: null,
          previous: null,
          results: [],
          page,
          limit,
          message: 'Survey not found or access denied',
          metadata: { accessible_surveys: [] }
        });
      }
    } else if (accessibleSurveys.length > 1) {
      // Multiple surveys available but no selection — require explicit choice
      return sendSuccess(res, {
        count: 0,
        next: null,
        previous: null,
        results: [],
        page,
        limit,
        message: 'Please select a survey to view submissions',
        metadata: {
          accessible_surveys: allAccessibleSurveys.map(s => ({
            asset_id: s.asset_id,
            name: s.name,
            country_id: s.country_id,
            alert_codes: s.alert_codes || {}
          }))
        }
      });
    }

    // Enumerator restrictions
    const allowedEnumerators = user.permissions?.enumerators || [];
    const hasEnumeratorRestrictions = allowedEnumerators.length > 0;
    const enumeratorFilter = hasEnumeratorRestrictions
      ? { submitted_by: { $in: allowedEnumerators } }
      : {};

    // Cap limit to avoid oversized responses
    const effectiveLimit = Math.min(limit, 10000);

    // Fetch submissions from MongoDB for each accessible survey
    const submissionsPromises = accessibleSurveys.map(async (survey) => {
      const collectionName = getSurveyFlagsCollection(survey.asset_id);

      try {
        const mongoSubmissions = await database.collection(collectionName)
          .find(
            { type: { $ne: 'metadata' }, ...enumeratorFilter },
            {
              projection: {
                submission_id: 1,
                submission_date: 1,
                vessel_number: 1,
                catch_number: 1,
                submitted_by: 1,
                validation_status: 1,
                validated_at: 1,
                validated_by: 1,
                alert_flag: 1,
                _id: 0
              }
            }
          )
          .sort({ submission_date: -1 })
          .limit(effectiveLimit)
          .toArray();

        return {
          asset_id: survey.asset_id,
          submissions: mongoSubmissions,
          survey_name: survey.name,
          survey_country: survey.country_id
        };
      } catch (error) {
        console.error(`Error fetching submissions for survey ${survey.asset_id}:`, error);
        return {
          asset_id: survey.asset_id,
          submissions: [],
          survey_name: survey.name,
          survey_country: survey.country_id
        };
      }
    });

    const surveySubmissions = await Promise.all(submissionsPromises);

    let allSubmissions = [];

    surveySubmissions.forEach(surveyData => {
      const processedSubmissions = surveyData.submissions.map(mongoDoc => ({
        submission_id: mongoDoc.submission_id,
        submission_date: mongoDoc.submission_date,
        vessel_number: mongoDoc.vessel_number || '',
        catch_number: mongoDoc.catch_number || '',
        submitted_by: mongoDoc.submitted_by || '',
        validation_status: mongoDoc.validation_status || 'validation_status_on_hold',
        validated_at: mongoDoc.validated_at || null,
        validated_by: mongoDoc.validated_by || '',
        alert_flag: mongoDoc.alert_flag || '',
        alert_flags: mongoDoc.alert_flag ? mongoDoc.alert_flag.split(', ') : [],
        asset_id: surveyData.asset_id,
        survey_name: surveyData.survey_name || 'Unknown Survey',
        survey_country: surveyData.survey_country || ''
      }));

      allSubmissions.push(...processedSubmissions);
    });

    // Sort combined results by submission_date descending
    allSubmissions.sort((a, b) => {
      if (!a.submission_date) return 1;
      if (!b.submission_date) return -1;
      return new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime();
    });

    // Apply pagination
    const totalCount = allSubmissions.length;
    const paginatedSubmissions = allSubmissions.slice(skip, skip + limit);
    const hasNextPage = skip + limit < totalCount;

    return sendSuccess(res, {
      count: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      next: hasNextPage ? `/api/kobo/submissions?page=${page + 1}&limit=${limit}` : null,
      previous: page > 1 ? `/api/kobo/submissions?page=${page - 1}&limit=${limit}` : null,
      results: paginatedSubmissions,
      metadata: {
        accessible_surveys: allAccessibleSurveys.map(s => ({
          asset_id: s.asset_id,
          name: s.name,
          country_id: s.country_id,
          alert_codes: s.alert_codes || {}
        }))
      }
    });

  } catch (error) {
    console.error('Error in submissions handler:', error);
    return sendServerError(res, 'Failed to fetch submissions');
  }
}

module.exports = withMiddleware(handler, authenticateUser);
