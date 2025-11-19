/**
 * GET /api/kobo/edit-url/:id
 *
 * Generate Enketo edit URL for a KoboToolbox submission
 * Requires authentication
 */

const { getDb } = require('../../../lib/db');
const { sendDetailedError, setCorsHeaders } = require('../../../lib/response');
const { withMiddleware, authenticateUser } = require('../../../lib/middleware');
const { makeKoboRequest, isValidAssetId, sanitizeString } = require('../../../lib/api-utils');

async function handler(req, res) {
  // Set CORS headers
  setCorsHeaders(res, req);

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET method
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get submission ID from query parameter (Vercel converts [id] to query.id)
    const rawId = req.query.id;
    const { asset_id } = req.query;
    const rawAssetId = asset_id || process.env.KOBO_ASSET_ID;

    // Validate and sanitize inputs
    if (!rawId || typeof rawId !== 'string') {
      return sendDetailedError(res, 'GET /api/kobo/edit-url/:id - Missing ID',
        new Error('Submission ID is required'), req, 400);
    }

    if (!rawAssetId || typeof rawAssetId !== 'string') {
      return sendDetailedError(res, 'GET /api/kobo/edit-url/:id - Missing asset_id',
        new Error('asset_id parameter or KOBO_ASSET_ID env var is required'), req, 400);
    }

    // Sanitize inputs
    const id = sanitizeString(rawId, 100);
    const koboAssetId = sanitizeString(rawAssetId, 50);

    // Validate asset ID format
    if (!isValidAssetId(koboAssetId)) {
      return sendDetailedError(res, 'GET /api/kobo/edit-url/:id - Invalid asset_id',
        new Error('Invalid asset_id format'), req, 400);
    }

    // Fetch survey configuration to get the correct API URL
    const database = await getDb();
    if (!database) {
      return sendDetailedError(res, 'GET /api/kobo/edit_url/:id - Database connection',
        new Error('Database connection not available'), req, 500);
    }

    const survey = await database.collection('surveys').findOne({ asset_id: koboAssetId });
    if (!survey) {
      return sendDetailedError(res, 'GET /api/kobo/edit_url/:id - Survey not found',
        new Error(`Survey with asset_id '${koboAssetId}' not found in database`), req, 404);
    }

    if (!survey.kobo_config) {
      return sendDetailedError(res, 'GET /api/kobo/edit_url/:id - Missing KoboToolbox config',
        new Error(`Survey '${survey.name}' (${koboAssetId}) has no kobo_config. Run update_single_survey.R to configure.`), req, 500);
    }

    const { api_url, token } = survey.kobo_config;

    if (!api_url || !token) {
      return sendDetailedError(res, 'GET /api/kobo/edit_url/:id - Incomplete KoboToolbox config',
        new Error(`Survey '${survey.name}' kobo_config is missing api_url or token`), req, 500);
    }

    const url = `${api_url}/assets/${koboAssetId}/data/${id}/enketo/edit/?return_url=false`;

    // Use robust API request with rate limiting and retries
    const response = await makeKoboRequest(url, token, {
      method: 'GET',
    });

    if (!response.data?.url) {
      return sendDetailedError(res, 'GET /api/kobo/edit-url/:id - Invalid KoboToolbox response',
        new Error('KoboToolbox API did not return an edit URL'), req, 500);
    }

    return res.json({ url: response.data.url });
  } catch (error) {
    // Handle Axios errors specifically
    if (error.isAxiosError) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.detail || error.response?.statusText || error.message;
      return sendDetailedError(res, 'GET /api/kobo/edit-url/:id - KoboToolbox API error',
        new Error(`KoboToolbox API error: ${status} - ${message}`),
        req, status);
    }

    // Handle other errors
    return sendDetailedError(res, 'GET /api/kobo/edit-url/:id', error, req, 500);
  }
}

// Apply authentication middleware
module.exports = withMiddleware(handler, authenticateUser);
