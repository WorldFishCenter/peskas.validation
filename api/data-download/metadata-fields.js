/**
 * GET /api/data-download/metadata-fields
 *
 * Fetch field metadata from PeSKAS API for landings dataset.
 * Returns comprehensive field documentation including descriptions, data types,
 * units, examples, and categorical values.
 *
 * This endpoint is used to enhance UX in the Data Download feature by providing
 * users with detailed information about what each data column means.
 *
 * @access Protected - Requires JWT authentication
 *
 * Query Parameters (all optional):
 * @queryparam {string} scope - Optional scope filter: "trip_info" or "catch_info"
 *
 * Response Format:
 * {
 *   fields: {
 *     field_name: {
 *       description: string,
 *       type: string,        // 'string', 'integer', 'float', 'datetime'
 *       unit: string,        // 'kg', 'cm', 'hours', etc.
 *       example: string,
 *       values: string[],    // For categorical fields
 *       range: { min: number, max: number },
 *       ontology_url: string,
 *       reference_url: string
 *     }
 *   },
 *   scope: string           // The scope filter used (if any)
 * }
 *
 * @module api/data-download/metadata-fields
 */

const { withMiddleware, authenticateUser } = require('../../lib/middleware');
const { fetchLandingsMetadata, PeskasAPIError } = require('../../lib/peskas-api');
const {
  sendSuccess,
  sendServerError,
  setCorsHeaders
} = require('../../lib/response');

/**
 * Handler function for metadata-fields endpoint
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
    // Extract scope parameter if provided
    const { scope } = req.query;

    // Fetch metadata from PeSKAS API
    const metadata = await fetchLandingsMetadata(scope);

    // Return success response
    // Include scope in response for client-side cache key generation
    return sendSuccess(res, {
      ...metadata,
      scope: scope || null
    });

  } catch (error) {
    console.error('Metadata fetch error:', error);

    // Handle PeSKAS API errors with user-friendly messages
    if (error instanceof PeskasAPIError) {
      // For 404 errors, return empty metadata (graceful degradation)
      if (error.statusCode === 404) {
        return sendSuccess(res, {
          fields: {},
          scope: req.query.scope || null,
          message: 'Field metadata is currently unavailable'
        });
      }
      return sendServerError(res, error.message);
    }

    // Generic error
    return sendServerError(res, 'Failed to fetch field metadata. Please try again later.');
  }
}

module.exports = withMiddleware(handler, authenticateUser);
