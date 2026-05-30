/**
 * GET /api/data-download/explorer-data
 *
 * Returns a CAPPED, permission-filtered slice of the PeSKAS landings data as JSON
 * (a bare array of row objects), for the in-browser R lessons in the Data Explorer tab.
 *
 * This is the Data Explorer counterpart to /api/data-download/export. It reuses the
 * exact same permission gate (applyDownloadPermissions), so a lesson can only ever see
 * the data the same user could download. Differences from export:
 *   - JSON, not CSV — the lesson's {ojs} cell hands the array to a {webr} cell via
 *     quarto-live's `input` option, where quarto-live converts the array of row objects
 *     directly into an R data.frame (types preserved, no brittle read.csv parsing).
 *   - Row count is capped at LESSON_ROW_CAP so it loads comfortably into the webR runtime.
 *
 * @access Protected - Requires JWT authentication (Bearer token)
 * @permission Filtered by user's country/survey/GAUL code permissions
 *
 * Query Parameters (all optional, snake_case - same semantics as preview.js/export.js):
 *   country, status, gaul_2, catch_taxon, scope. For admins `country` is optional and
 *   defaults to their first accessible survey's country so lessons work without a picker.
 *
 * Response: application/json — a bare array of landing-record objects.
 *
 * @module api/data-download/explorer-data
 */

const { withMiddleware, authenticateUser } = require('../../lib/middleware');
const { fetchLandingsData, PeskasAPIError } = require('../../lib/peskas-api');
const { applyDownloadPermissions, getAccessibleSurveys } = require('../../lib/filter-permissions');
const {
  sendServerError,
  setCorsHeaders
} = require('../../lib/response');
const { logAuditEvent } = require('../../lib/audit-logger');
const { getDb } = require('../../lib/db');

// Cap rows so the dataset loads quickly into the in-browser webR runtime.
// Lessons teach techniques on a representative slice, not the full ~1M-row export.
const LESSON_ROW_CAP = 5000;

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

    // Admins must normally specify a country (see applyDownloadPermissions). For the
    // Data Explorer we default it to their first accessible survey's country so a
    // lesson can load data without a country picker. Regular users are always scoped
    // to user.country[0] regardless of this value.
    const queryParams = { ...req.query };
    if (req.user.role === 'admin' && !queryParams.country) {
      const surveys = await getAccessibleSurveys(req.user);
      if (surveys.length > 0) {
        queryParams.country = surveys[0].country_id;
      }
    }

    const {
      effectiveCountry,
      effectiveGaulCodes
    } = await applyDownloadPermissions(req.user, queryParams);

    const {
      status = 'validated',
      catch_taxon,
      scope
    } = queryParams;

    // PeSKAS API requires lowercase country codes
    const apiFilters = {
      country: effectiveCountry.toLowerCase(),
      status
    };

    // Add optional filters only if provided (mirrors preview.js/export.js)
    if (scope && scope.trim()) {
      apiFilters.scope = scope.trim();
    }
    if (effectiveGaulCodes.length > 0) {
      // PeSKAS API doesn't support multiple gaul_2 codes - use first one
      apiFilters.gaul_2 = effectiveGaulCodes[0];
    }
    if (catch_taxon && catch_taxon.trim()) {
      apiFilters.catch_taxon = catch_taxon.trim();
    }

    // Fetch JSON (array of row objects). Normalize the response shape the same way
    // preview.js does (the API returns either a bare array or { data: [...] }).
    const apiResponse = await fetchLandingsData(apiFilters, LESSON_ROW_CAP);
    const rows = Array.isArray(apiResponse)
      ? apiResponse
      : (Array.isArray(apiResponse?.data) ? apiResponse.data : []);

    res.setHeader('Cache-Control', 'no-store');

    await logAuditEvent(database, {
      username: req.user.username,
      user_id: req.user.id,
      category: 'download',
      action: 'data_explorer_load',
      status: 'success',
      details: {
        country_id: apiFilters.country || null,
        data_status: apiFilters.status || null,
        scope: apiFilters.scope || null,
        catch_taxon: apiFilters.catch_taxon || null,
        district: apiFilters.gaul_2 || null,
        row_cap: LESSON_ROW_CAP,
        row_count: rows.length
      },
      req
    });

    return res.json(rows);

  } catch (error) {
    console.error('Data explorer load error:', error);

    if (error instanceof PeskasAPIError) {
      return sendServerError(res, error.message);
    }

    return sendServerError(res, 'Failed to load explorer data. Please try again later.');
  }
}

module.exports = withMiddleware(handler, authenticateUser);
