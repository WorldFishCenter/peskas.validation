/**
 * GET /api/data-download/preview
 *
 * Fetch preview data (first 20 rows) from PeSKAS API with permission-based filtering.
 *
 * Admin users can select any country and GAUL codes.
 * Regular users are restricted to their assigned country and GAUL codes.
 *
 * @access Protected - Requires JWT authentication
 * @permission Filtered by user's country/survey/GAUL code permissions
 *
 * Query Parameters (all optional, snake_case format):
 * @queryparam {string} country - Country code (lowercase, e.g., "zanzibar", "mozambique")
 *                                Admin: required parameter
 *                                Regular user: uses first assigned country from user.country[0]
 * @queryparam {string} survey_id - Survey asset_id (currently NOT sent to PeSKAS API - see limitation)
 * @queryparam {string} gaul_2 - District GAUL code (single value only, e.g., "12345")
 * @queryparam {string} status - Data validation status: "validated" or "raw" (default: "validated")
 * @queryparam {string} catch_taxon - FAO ASFIS species code (3 letters, e.g., "SKJ", "YFT")
 * @queryparam {string} scope - Data scope: "trip_info" or "catch_info" (optional)
 *
 * Known Limitations:
 * - survey_id filtering is disabled (PeSKAS uses different survey identifiers)
 * - gaul_2 only supports single district (PeSKAS API limitation)
 *
 * Response Format:
 * {
 *   data: [{...landing records...}],
 *   total_count: number,
 *   filters_applied: {...actual filters sent to PeSKAS API...}
 * }
 *
 * @module api/data-download/preview
 */

const { withMiddleware, authenticateUser } = require('../../lib/middleware');
const { fetchLandingsData, PeskasAPIError } = require('../../lib/peskas-api');
const { applyDownloadPermissions } = require('../../lib/filter-permissions');
const {
  sendSuccess,
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
    // 1. Apply permission-based filtering using shared utility
    // Note: req.user is populated by authenticateUser middleware with full user data
    // applyDownloadPermissions reads country, survey_id, gaul_2 from req.query
    const {
      effectiveCountry,
      effectiveSurveyIds, // eslint-disable-line no-unused-vars -- Reserved for future survey_id filtering
      effectiveGaulCodes
    } = await applyDownloadPermissions(req.user, req.query);

    // 2. Extract additional query parameters for API filters
    const {
      status = 'validated',
      catch_taxon,
      scope
    } = req.query;

    // 3. Build API filters
    // PeSKAS API requires lowercase country codes
    const apiFilters = {
      country: effectiveCountry.toLowerCase(),
      status: status || 'validated'
    };

    // Add optional filters only if provided
    if (scope && scope.trim()) {
      apiFilters.scope = scope.trim();
    }
    // TEMPORARY: Survey ID filtering disabled - PeSKAS API uses different survey IDs
    // TODO: Map MongoDB survey IDs to PeSKAS API survey IDs or remove survey filter
    // if (effectiveSurveyIds.length > 0) {
    //   apiFilters.survey_id = effectiveSurveyIds[0];
    // }
    if (effectiveGaulCodes.length > 0) {
      // PeSKAS API doesn't support multiple gaul_2 codes - use first one
      apiFilters.gaul_2 = effectiveGaulCodes[0];
    }
    if (catch_taxon && catch_taxon.trim()) {
      apiFilters.catch_taxon = catch_taxon.trim();
    }

    // 4. Fetch preview data (20 rows)
    const apiResponse = await fetchLandingsData(apiFilters, 20);

    // 5. Extract data and count
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

    // 6. Return success response
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
