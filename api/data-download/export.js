/**
 * GET /api/data-download/export
 *
 * Export full dataset as CSV from PeSKAS API with permission-based filtering.
 *
 * Admin users can select any country and GAUL codes.
 * Regular users are restricted to their assigned country and GAUL codes.
 *
 * @module api/data-download/export
 */

const { withMiddleware, authenticateUser } = require('../../lib/middleware');
const { getDb } = require('../../lib/db');
const { getLandingsCSVStream, PeskasAPIError } = require('../../lib/peskas-api');
const { applyDownloadPermissions } = require('../../lib/filter-permissions');
const { sanitizeCSV } = require('../../lib/helpers');
const {
  sendBadRequest,
  sendServerError,
  setCorsHeaders
} = require('../../lib/response');

/**
 * Handler function for export endpoint
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

    // 5. Fetch CSV data
    const csvData = await getLandingsCSVStream(apiFilters);

    // 6. Sanitize CSV to prevent formula injection
    const sanitizedCSV = sanitizeCSV(csvData);

    // 7. Set CSV headers
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `peskas-landings-${effectiveCountry.toLowerCase()}-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    // 8. Send sanitized CSV data
    return res.send(sanitizedCSV);

  } catch (error) {
    console.error('Export error:', error);

    // Handle PeSKAS API errors with user-friendly messages
    if (error instanceof PeskasAPIError) {
      return sendServerError(res, error.message);
    }

    // Generic error
    return sendServerError(res, 'Failed to export data. Please try again later.');
  }
}

module.exports = withMiddleware(handler, authenticateUser);
