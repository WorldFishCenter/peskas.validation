/**
 * GET /api/data-download/export
 *
 * Export full dataset as CSV from PeSKAS API with permission-based filtering.
 * Returns a downloadable CSV file (max 1,000,000 rows).
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
 * - All users share the same PESKAS_API_KEY (no per-user rate limiting)
 *
 * Security:
 * - CSV is sanitized to prevent formula injection attacks
 * - Permission filtering enforced server-side
 * - Rate limiting: 1 second delay between PeSKAS API requests
 *
 * Response Format:
 * Content-Type: text/csv; charset=utf-8
 * Content-Disposition: attachment; filename="peskas-landings-{country}-{date}.csv"
 *
 * @module api/data-download/export
 */

const { withMiddleware, authenticateUser } = require('../../lib/middleware');
const { getLandingsCSVStream, PeskasAPIError } = require('../../lib/peskas-api');
const { applyDownloadPermissions } = require('../../lib/filter-permissions');
const { sanitizeCSV } = require('../../lib/helpers');
const {
  sendServerError,
  setCorsHeaders
} = require('../../lib/response');
const { logAuditEvent } = require('../../lib/audit-logger');
const { getDb } = require('../../lib/db');

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
    const database = await getDb();

    const {
      effectiveCountry,
      effectiveSurveyIds, // eslint-disable-line no-unused-vars -- Reserved for future survey_id filtering
      effectiveGaulCodes
    } = await applyDownloadPermissions(req.user, req.query);

    const {
      status = 'validated',
      catch_taxon,
      scope
    } = req.query;

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

    const csvData = await getLandingsCSVStream(apiFilters);
    const sanitizedCSV = sanitizeCSV(csvData);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `peskas-landings-${effectiveCountry.toLowerCase()}-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    await logAuditEvent(database, {
      username: req.user.username,
      user_id: req.user.id,
      category: 'download',
      action: 'data_export',
      status: 'success',
      details: {
        country_id: apiFilters.country || null,
        survey_asset_id: req.query.survey_id || null,
        data_status: apiFilters.status || null,
        scope: apiFilters.scope || null,
        catch_taxon: apiFilters.catch_taxon || null,
        district: apiFilters.gaul_2 || null,
      },
      req
    });

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
