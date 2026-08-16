/**
 * PATCH /api/kobo/validation-status/:id
 *
 * Update validation status in KoboToolbox API
 * Requires authentication
 */

const { sendDetailedError, sendForbidden, setCorsHeaders } = require('../../../lib/response');
const { withMiddleware, authenticateUser } = require('../../../lib/middleware');
const { makeKoboRequest, isValidAssetId, sanitizeString } = require('../../../lib/api-utils');
const { getAccessibleSurveys } = require('../../../lib/filter-permissions');
const { VALIDATION_STATUSES } = require('../../../lib/helpers');

async function handler(req, res) {
  // Set CORS headers
  setCorsHeaders(res, req);

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow PATCH method
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get submission ID from query parameter (Vercel converts [id] to query.id)
    const rawId = req.query.id;
    const { validation_status: rawStatus, asset_id } = req.body;
    const rawAssetId = asset_id || process.env.KOBO_ASSET_ID;

    // Validate inputs
    if (!rawId || typeof rawId !== 'string') {
      return sendDetailedError(res, 'PATCH /api/kobo/validation-status/:id - Missing ID',
        new Error('Submission ID is required'), req, 400);
    }

    if (!rawStatus || typeof rawStatus !== 'string') {
      return sendDetailedError(res, 'PATCH /api/kobo/validation-status/:id - Missing validation_status',
        new Error('validation_status is required in request body'), req, 400);
    }

    if (!rawAssetId || typeof rawAssetId !== 'string') {
      return sendDetailedError(res, 'PATCH /api/kobo/validation-status/:id - Missing asset_id',
        new Error('asset_id in body or KOBO_ASSET_ID env var is required'), req, 400);
    }

    // Sanitize inputs
    const id = sanitizeString(rawId, 100);
    const validation_status = sanitizeString(rawStatus, 100);
    const koboAssetId = sanitizeString(rawAssetId, 50);

    // Validate asset ID format
    if (!isValidAssetId(koboAssetId)) {
      return sendDetailedError(res, 'PATCH /api/kobo/validation-status/:id - Invalid asset_id',
        new Error('Invalid asset_id format'), req, 400);
    }

    // Validate validation_status against the shared list, so this endpoint and the MongoDB one
    // accept exactly the same set.
    if (!VALIDATION_STATUSES.includes(validation_status)) {
      return sendDetailedError(res, 'PATCH /api/kobo/validation-status/:id - Invalid validation_status',
        new Error(`validation_status must be one of: ${VALIDATION_STATUSES.join(', ')}`), req, 400);
    }

    // Permission check before touching the database or KoboToolbox. This endpoint writes to the
    // external system the R pipeline reconciles Mongo *from*, so it is the more consequential of
    // the two write paths — it previously had authentication but no authorization, letting any
    // signed-in user set a status on any survey. Resolving the survey through the permission
    // filter also stops the error messages below from disclosing names and config state of
    // surveys the caller cannot see.
    const accessibleSurveys = await getAccessibleSurveys(req.user);
    const survey = accessibleSurveys.find(s => s.asset_id === koboAssetId);

    if (!survey) {
      return sendForbidden(res, 'You do not have access to the requested survey.');
    }

    if (!survey.kobo_config) {
      return sendDetailedError(res, 'PATCH /api/kobo/validation_status/:id - Missing KoboToolbox config',
        new Error(`Survey '${survey.name}' (${koboAssetId}) has no kobo_config. Run update_single_survey.R to configure.`), req, 500);
    }

    const { api_url, token } = survey.kobo_config;

    if (!api_url || !token) {
      return sendDetailedError(res, 'PATCH /api/kobo/validation_status/:id - Incomplete KoboToolbox config',
        new Error(`Survey '${survey.name}' kobo_config is missing api_url or token`), req, 500);
    }

    const url = `${api_url}/assets/${koboAssetId}/data/${id}/validation_status/`;

    // Use robust API request with rate limiting and retries
    // Note: KoboToolbox API expects JSON body with "validation_status.uid" key
    await makeKoboRequest(url, token, {
      method: 'PATCH',
      data: {
        'validation_status.uid': validation_status
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return res.json({
      success: true,
      message: `Validation status correctly updated for submission ${id}`
    });
  } catch (error) {
    // Handle Axios errors specifically
    if (error.isAxiosError) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.detail || error.response?.statusText || error.message;
      return sendDetailedError(res, 'PATCH /api/kobo/validation-status/:id - KoboToolbox API error',
        new Error(`KoboToolbox API error: ${status} - ${message}`),
        req, status);
    }

    // Handle other errors
    return sendDetailedError(res, 'PATCH /api/kobo/validation-status/:id', error, req, 500);
  }
}

// Apply authentication middleware
module.exports = withMiddleware(handler, authenticateUser);
