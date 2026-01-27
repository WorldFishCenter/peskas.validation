/**
 * PeSKAS API Client for Data Downloads
 *
 * Handles API communication with the PeSKAS landings database at api.peskas.org
 * Includes rate limiting and error handling for production use.
 *
 * @module lib/peskas-api
 */

const axios = require('axios');

const PESKAS_API_BASE = 'https://api.peskas.org/api/v1';
const RATE_LIMIT_DELAY = 1000; // 1 second between requests
let lastRequestTime = 0;

// PeSKAS API requires X-API-Key header for authentication
const PESKAS_API_KEY = process.env.PESKAS_API_KEY || process.env.API_SECRET_KEY;
if (!PESKAS_API_KEY) {
  console.error('WARNING: PESKAS_API_KEY not found in environment variables');
  console.error('Set PESKAS_API_KEY or API_SECRET_KEY in .env file');
}

/**
 * Custom error class for PeSKAS API errors
 */
class PeskasAPIError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = 'PeskasAPIError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Validate API filter parameters before sending to external API
 * Prevents injection attacks and ensures data integrity
 */
function validateFilters(filters) {
  const errors = [];

  // Validate country (lowercase letters, hyphens, underscores only)
  if (filters.country && !/^[a-z_-]+$/i.test(filters.country)) {
    errors.push('Invalid country format');
  }

  // Validate status (only allowed values)
  if (filters.status && !['validated', 'raw'].includes(filters.status)) {
    errors.push('Invalid status value (must be "validated" or "raw")');
  }

  // Validate scope (only allowed values)
  if (filters.scope && !['trip_info', 'catch_info'].includes(filters.scope)) {
    errors.push('Invalid scope value (must be "trip_info" or "catch_info")');
  }

  // Validate catch_taxon (3-letter FAO ASFIS code)
  if (filters.catch_taxon && !/^[A-Z]{3}$/i.test(filters.catch_taxon)) {
    errors.push('Invalid catch_taxon format (must be 3-letter FAO code, e.g., SKJ, MZZ)');
  }

  // Validate survey_id (alphanumeric with underscores/hyphens)
  if (filters.survey_id && !/^[a-zA-Z0-9_-]+$/.test(filters.survey_id)) {
    errors.push('Invalid survey_id format');
  }

  // Validate gaul_2 (numeric code)
  if (filters.gaul_2 && !/^\d+$/.test(filters.gaul_2)) {
    errors.push('Invalid gaul_2 format (must be numeric code)');
  }

  if (errors.length > 0) {
    throw new PeskasAPIError(
      `Validation failed: ${errors.join('; ')}`,
      'VALIDATION_ERROR',
      400
    );
  }
}

/**
 * Rate-limited API request wrapper
 *
 * Ensures requests are spaced at least RATE_LIMIT_DELAY ms apart
 * to avoid overwhelming the PeSKAS API.
 *
 * @param {string} endpoint - API endpoint path (e.g., '/data/landings')
 * @param {object} params - Query parameters
 * @returns {Promise<any>} API response data
 * @throws {PeskasAPIError} On API errors
 */
async function makeRateLimitedRequest(endpoint, params) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  // Apply rate limiting
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve =>
      setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();

  try {
    const response = await axios.get(`${PESKAS_API_BASE}${endpoint}`, {
      params,
      headers: {
        'X-API-Key': PESKAS_API_KEY
      },
      timeout: 60000, // 60 second timeout
      validateStatus: (status) => status < 500 // Don't reject on 4xx errors
    });

    // Handle authentication errors
    if (response.status === 401) {
      throw new PeskasAPIError(
        'Authentication failed. Please check your API key configuration.',
        'AUTHENTICATION_ERROR',
        401
      );
    }

    // Handle specific error status codes
    if (response.status === 429) {
      throw new PeskasAPIError(
        'Rate limit exceeded. Please try again in a few minutes.',
        'RATE_LIMIT_EXCEEDED',
        429
      );
    }

    if (response.status === 404) {
      throw new PeskasAPIError(
        'No data found for the specified filters. Try adjusting your search criteria.',
        'NO_DATA_FOUND',
        404
      );
    }

    if (response.status === 400) {
      const errorDetail = response.data?.detail || response.data?.message || response.data?.error || 'Unknown error';

      throw new PeskasAPIError(
        `Invalid request parameters: ${errorDetail}`,
        'INVALID_PARAMETERS',
        400
      );
    }

    if (response.status >= 400) {
      throw new PeskasAPIError(
        `API request failed with status ${response.status}`,
        'API_ERROR',
        response.status
      );
    }

    return response.data;

  } catch (error) {
    // Re-throw PeskasAPIError instances
    if (error instanceof PeskasAPIError) {
      throw error;
    }

    // Handle network/timeout errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new PeskasAPIError(
        'Request timed out. The dataset may be too large. Try narrowing your date range.',
        'TIMEOUT',
        504
      );
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new PeskasAPIError(
        'Unable to connect to PeSKAS API. Please check your internet connection.',
        'CONNECTION_ERROR',
        503
      );
    }

    // Generic error
    throw new PeskasAPIError(
      'Failed to fetch data from PeSKAS API. Please try again later.',
      'API_ERROR',
      500
    );
  }
}

/**
 * Fetch landings data with filters
 *
 * Returns data in JSON format (for preview or processing)
 *
 * @param {object} filters - Filter parameters
 * @param {string} filters.country - Country identifier (e.g., 'zanzibar')
 * @param {string} [filters.survey_id] - Survey ID(s) - comma-separated (e.g., 'asset123,asset456')
 * @param {string} [filters.status='validated'] - Data status ('validated' or 'raw')
 * @param {string} [filters.date_from] - Start date (YYYY-MM-DD)
 * @param {string} [filters.date_to] - End date (YYYY-MM-DD)
 * @param {string} [filters.gaul_1] - GAUL level 1 code
 * @param {string} [filters.gaul_2] - GAUL level 2 code(s) - comma-separated
 * @param {string} [filters.catch_taxon] - FAO ASFIS species code
 * @param {string} [filters.scope='trip_info'] - Data scope ('trip_info' or 'catch_info')
 * @param {number} [limit=20] - Maximum number of rows to return
 * @returns {Promise<object>} API response with data array
 * @throws {PeskasAPIError} On API errors
 *
 * @example
 * const data = await fetchLandingsData({
 *   country: 'zanzibar',
 *   status: 'validated',
 *   date_from: '2024-01-01',
 *   date_to: '2024-12-31'
 * }, 20);
 */
async function fetchLandingsData(filters, limit = 20) {
  // Validate filters before sending to external API
  validateFilters(filters);

  const params = {
    format: 'json', // Always JSON for preview/processing
    limit: limit,
    ...filters
  };

  return makeRateLimitedRequest('/data/landings', params);
}

/**
 * Get CSV download stream (for full dataset export)
 *
 * Returns raw CSV data as text string suitable for browser download.
 * Sets format=csv and limit to maximum (1,000,000 rows).
 *
 * @param {object} filters - Filter parameters (same as fetchLandingsData)
 * @returns {Promise<string>} CSV data as text
 * @throws {PeskasAPIError} On API errors
 *
 * @example
 * const csvData = await getLandingsCSVStream({
 *   country: 'zanzibar',
 *   status: 'validated'
 * });
 * // csvData is a CSV string ready for download
 */
async function getLandingsCSVStream(filters) {
  // Validate filters before sending to external API
  validateFilters(filters);

  const params = {
    format: 'csv',
    limit: 1000000, // Max limit
    ...filters
  };

  return makeRateLimitedRequest('/data/landings', params);
}

/**
 * Fetch metadata for landings dataset
 *
 * Returns comprehensive field documentation including descriptions, data types,
 * units, examples, and categorical values. Used for enhancing UX with field
 * descriptions in the Data Download feature.
 *
 * @param {string} [scope] - Optional scope filter ('trip_info' or 'catch_info')
 * @returns {Promise<object>} Metadata object with field descriptions
 * @throws {PeskasAPIError} On API errors
 *
 * @example
 * const metadata = await fetchLandingsMetadata('trip_info');
 * // Returns: { fields: { field_name: { description, type, unit, ... } } }
 */
async function fetchLandingsMetadata(scope) {
  const params = {};

  // Validate scope if provided
  if (scope && scope.trim()) {
    if (!['trip_info', 'catch_info'].includes(scope.trim())) {
      throw new PeskasAPIError(
        'Invalid scope value (must be "trip_info" or "catch_info")',
        'VALIDATION_ERROR',
        400
      );
    }
    params.scope = scope.trim();
  }

  return makeRateLimitedRequest('/metadata/landings', params);
}

module.exports = {
  fetchLandingsData,
  getLandingsCSVStream,
  fetchLandingsMetadata,
  PeskasAPIError
};
