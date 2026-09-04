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

const { withMiddleware } = require('../../lib/middleware');
const { getLandingsCSVMerged, PeskasAPIError } = require('../../lib/peskas-api');
const { resolveDownloadRequests, DownloadPermissionError } = require('../../lib/filter-permissions');
const { sanitizeCSV } = require('../../lib/helpers');
const { sendError, sendServerError } = require('../../lib/response');
const { logAuditEvent } = require('../../lib/audit-logger');

/**
 * Handler function for export endpoint
 */
async function handler(req, res) {
  try {
    const database = req.db;

    // Resolve the selection into permission-safe PeSKAS requests. Each request is pinned
    // to a survey the user may access, with the country derived per-survey. A user with
    // several forms/districts fans out to multiple CSV requests that are merged below.
    const requests = await resolveDownloadRequests(req.db, req.user, req.query);

    const {
      status = 'validated',
      catch_taxon,
      scope
    } = req.query;

    // Filters applied to every request (single-valued, shared across the fan-out)
    const sharedFilters = { status: status || 'validated' };
    if (scope && scope.trim()) {
      sharedFilters.scope = scope.trim();
    }
    if (catch_taxon && catch_taxon.trim()) {
      sharedFilters.catch_taxon = catch_taxon.trim();
    }

    // PeSKAS API requires lowercase country codes
    const normalizedRequests = requests.map(r => ({ ...r, country: r.country.toLowerCase() }));

    const csvData = await getLandingsCSVMerged(normalizedRequests, sharedFilters);
    const sanitizedCSV = sanitizeCSV(csvData);

    // Distinct scope actually served (for filename + audit)
    const countries = [...new Set(normalizedRequests.map(r => r.country))];
    const surveyIds = [...new Set(normalizedRequests.map(r => r.survey_id).filter(Boolean))];
    const districts = [...new Set(normalizedRequests.map(r => r.gaul_2).filter(Boolean))];

    const timestamp = new Date().toISOString().split('T')[0];
    const countryLabel = countries.length === 1 ? countries[0] : 'multi-country';
    const filename = `peskas-landings-${countryLabel}-${timestamp}.csv`;

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
        country_id: countries.join(',') || null,
        survey_asset_id: surveyIds.join(',') || null,
        data_status: sharedFilters.status || null,
        scope: sharedFilters.scope || null,
        catch_taxon: sharedFilters.catch_taxon || null,
        district: districts.join(',') || null,
        request_count: normalizedRequests.length,
      },
      req
    });

    return res.send(sanitizedCSV);

  } catch (error) {
    console.error('Export error:', error);

    // Permission/selection errors → clear 400/403 for the client
    if (error instanceof DownloadPermissionError) {
      return sendError(res, error.message, error.statusCode);
    }

    // Handle PeSKAS API errors with user-friendly messages
    if (error instanceof PeskasAPIError) {
      return sendServerError(res, error.message);
    }

    // Generic error
    return sendServerError(res, 'Failed to export data. Please try again later.');
  }
}

module.exports = withMiddleware(handler, { methods: ['GET'] });
