/**
 * PATCH /api/kobo/validation-status/:id
 *
 * Update validation status in KoboToolbox API
 * Requires authentication
 */

const { HttpError, sendForbidden } = require('../../../lib/response');
const { withMiddleware } = require('../../../lib/middleware');
const { makeKoboRequest, isValidAssetId, sanitizeString } = require('../../../lib/api-utils');
const { getAccessibleSurveys } = require('../../../lib/filter-permissions');
const { VALIDATION_STATUSES } = require('../../../lib/helpers');

async function handler(req, res) {
  try {
    // Get submission ID from query parameter (Vercel converts [id] to query.id)
    const rawId = req.query.id;
    const { validation_status: rawStatus, asset_id } = req.body;
    const rawAssetId = asset_id || process.env.KOBO_ASSET_ID;

    // Validate inputs
    if (!rawId || typeof rawId !== 'string') {
      throw new HttpError('Submission ID is required', 400);
    }

    if (!rawStatus || typeof rawStatus !== 'string') {
      throw new HttpError('validation_status is required in request body', 400);
    }

    if (!rawAssetId || typeof rawAssetId !== 'string') {
      throw new HttpError('asset_id in body or KOBO_ASSET_ID env var is required', 400);
    }

    // Sanitize inputs
    const id = sanitizeString(rawId, 100);
    const validation_status = sanitizeString(rawStatus, 100);
    const koboAssetId = sanitizeString(rawAssetId, 50);

    // Validate asset ID format
    if (!isValidAssetId(koboAssetId)) {
      throw new HttpError('Invalid asset_id format', 400);
    }

    // Validate validation_status against the shared list, so this endpoint and the MongoDB one
    // accept exactly the same set.
    if (!VALIDATION_STATUSES.includes(validation_status)) {
      throw new HttpError(`validation_status must be one of: ${VALIDATION_STATUSES.join(', ')}`, 400);
    }

    // Permission check before touching the database or KoboToolbox. This endpoint writes to the
    // external system the R pipeline reconciles Mongo *from*, so it is the more consequential of
    // the two write paths — it previously had authentication but no authorization, letting any
    // signed-in user set a status on any survey. Resolving the survey through the permission
    // filter also stops the error messages below from disclosing names and config state of
    // surveys the caller cannot see.
    const accessibleSurveys = await getAccessibleSurveys(req.db, req.user);
    const survey = accessibleSurveys.find(s => s.asset_id === koboAssetId);

    if (!survey) {
      return sendForbidden(res, 'You do not have access to the requested survey.');
    }

    if (!survey.kobo_config) {
      throw new Error(`Survey '${survey.name}' (${koboAssetId}) has no kobo_config. Run update_single_survey.R to configure.`);
    }

    const { api_url, token } = survey.kobo_config;

    if (!api_url || !token) {
      throw new Error(`Survey '${survey.name}' kobo_config is missing api_url or token`);
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
    // An upstream KoboToolbox failure is reported at the status KoboToolbox gave us.
    if (error.isAxiosError) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.detail || error.response?.statusText || error.message;
      throw new HttpError(`KoboToolbox API error: ${status} - ${message}`, status);
    }

    throw error;
  }
}

// Apply authentication middleware
module.exports = withMiddleware(handler, { methods: ['PATCH'] });
