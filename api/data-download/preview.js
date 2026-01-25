/**
 * GET /api/data-download/preview
 *
 * Fetch preview data (first 20 rows) from PeSKAS API with permission-based filtering.
 *
 * Admin users can select any country and GAUL codes.
 * Regular users are restricted to their assigned country and GAUL codes.
 *
 * @module api/data-download/preview
 */

const { withMiddleware, authenticateUser } = require('../../lib/middleware');
const { getDb } = require('../../lib/db');
const { fetchLandingsData, PeskasAPIError } = require('../../lib/peskas-api');
const { applyDownloadPermissions } = require('../../lib/filter-permissions');
const {
  sendSuccess,
  sendBadRequest,
  sendServerError,
  setCorsHeaders
} = require('../../lib/response');

/**
 * Handler function for preview endpoint
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
      return sendBadRequest(res, 'User not found');
    }

    // 2. Apply permission-based filtering using shared utility
    // Note: applyDownloadPermissions reads country, survey_id, gaul_2 from req.query
    const {
      effectiveCountry,
      effectiveSurveyIds,
      effectiveGaulCodes
    } = await applyDownloadPermissions(user, req.query);

    // 3. Extract additional query parameters for API filters
    const {
      status = 'validated',
      catch_taxon,
      scope
    } = req.query;

    // 4. Build API filters
    // PeSKAS API requires lowercase country codes
    const apiFilters = {
      country: effectiveCountry.toLowerCase(),
      status: status || 'validated'
    };

    // Add optional filters only if provided
    if (scope && scope.trim()) {
      apiFilters.scope = scope.trim();
    }
    if (effectiveSurveyIds.length > 0) {
      // PeSKAS API doesn't support multiple survey IDs - use first one
      apiFilters.survey_id = effectiveSurveyIds[0];
    }
    if (effectiveGaulCodes.length > 0) {
      // PeSKAS API doesn't support multiple gaul_2 codes - use first one
      apiFilters.gaul_2 = effectiveGaulCodes[0];
    }
    if (catch_taxon && catch_taxon.trim()) {
      apiFilters.catch_taxon = catch_taxon.trim();
    }

    // 5. Fetch preview data (20 rows)
    const apiResponse = await fetchLandingsData(apiFilters, 20);

    // 6. Extract data and count
    let data = [];
    let totalCount = 0;

    if (Array.isArray(apiResponse)) {
      // Response is directly an array
      data = apiResponse;
      totalCount = apiResponse.length;
    } else if (apiResponse.data && Array.isArray(apiResponse.data)) {
      // Response has data property
      data = apiResponse.data;
      totalCount = apiResponse.count || apiResponse.total || apiResponse.data.length;
    } else {
      // Unexpected format - return empty data
      data = [];
      totalCount = 0;
    }

    // 7. Return success response
    return sendSuccess(res, {
      data: data,
      total_count: totalCount,
      filters_applied: apiFilters
    });

  } catch (error) {
    console.error('Preview error:', error);

    // Handle PeSKAS API errors with user-friendly messages
    if (error instanceof PeskasAPIError) {
      return sendServerError(res, error.message);
    }

    // Generic error
    return sendServerError(res, 'Failed to fetch preview data. Please try again later.');
  }
}

module.exports = withMiddleware(handler, authenticateUser);
