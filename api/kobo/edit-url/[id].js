/**
 * GET /api/kobo/edit-url/:id
 *
 * Generate Enketo edit URL for a KoboToolbox submission
 * Requires authentication
 */

const { HttpError } = require('../../../lib/response');
const { withMiddleware } = require('../../../lib/middleware');
const { makeKoboRequest, isValidAssetId, sanitizeString } = require('../../../lib/api-utils');

async function handler(req, res) {
  try {
    // Get submission ID from query parameter (Vercel converts [id] to query.id)
    const rawId = req.query.id;
    const { asset_id } = req.query;
    const rawAssetId = asset_id || process.env.KOBO_ASSET_ID;

    // Validate and sanitize inputs
    if (!rawId || typeof rawId !== 'string') {
      throw new HttpError('Submission ID is required', 400);
    }

    if (!rawAssetId || typeof rawAssetId !== 'string') {
      throw new HttpError('asset_id parameter or KOBO_ASSET_ID env var is required', 400);
    }

    // Sanitize inputs
    const id = sanitizeString(rawId, 100);
    const koboAssetId = sanitizeString(rawAssetId, 50);

    // Validate asset ID format
    if (!isValidAssetId(koboAssetId)) {
      throw new HttpError('Invalid asset_id format', 400);
    }

    // Fetch survey configuration to get the correct API URL
    const database = req.db;
    const survey = await database.collection('surveys').findOne({ asset_id: koboAssetId });
    if (!survey) {
      throw new HttpError(`Survey with asset_id '${koboAssetId}' not found`, 404);
    }

    if (!survey.kobo_config) {
      throw new Error(`Survey '${survey.name}' (${koboAssetId}) has no kobo_config. Run update_single_survey.R to configure.`);
    }

    const { api_url, token } = survey.kobo_config;

    if (!api_url || !token) {
      throw new Error(`Survey '${survey.name}' kobo_config is missing api_url or token`);
    }

    const url = `${api_url}/assets/${koboAssetId}/data/${id}/enketo/edit/?return_url=false`;

    // Use robust API request with rate limiting and retries
    const response = await makeKoboRequest(url, token, {
      method: 'GET',
    });

    if (!response.data?.url) {
      throw new Error('KoboToolbox API did not return an edit URL');
    }

    return res.json({ url: response.data.url });
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
module.exports = withMiddleware(handler, { methods: ['GET'] });
