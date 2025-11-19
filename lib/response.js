/**
 * Standardized Response Helpers for Vercel Serverless Functions
 *
 * This module provides consistent response formatting and error handling
 * for all API endpoints.
 */

/**
 * Send a successful JSON response
 *
 * @param {Object} res - Response object
 * @param {*} data - Data to send
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Object} Response object
 */
function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json(data);
}

/**
 * Send an error JSON response
 *
 * @param {Object} res - Response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @returns {Object} Response object
 */
function sendError(res, message, statusCode = 500) {
  console.error(`Error ${statusCode}: ${message}`);
  return res.status(statusCode).json({ error: message });
}

/**
 * Send a 400 Bad Request error
 *
 * @param {Object} res - Response object
 * @param {string} message - Error message
 * @returns {Object} Response object
 */
function sendBadRequest(res, message) {
  return sendError(res, message, 400);
}

/**
 * Send a 401 Unauthorized error
 *
 * @param {Object} res - Response object
 * @param {string} message - Error message (default: 'Authentication required')
 * @returns {Object} Response object
 */
function sendUnauthorized(res, message = 'Authentication required') {
  return sendError(res, message, 401);
}

/**
 * Send a 403 Forbidden error
 *
 * @param {Object} res - Response object
 * @param {string} message - Error message (default: 'Access forbidden')
 * @returns {Object} Response object
 */
function sendForbidden(res, message = 'Access forbidden') {
  return sendError(res, message, 403);
}

/**
 * Send a 404 Not Found error
 *
 * @param {Object} res - Response object
 * @param {string} message - Error message (default: 'Resource not found')
 * @returns {Object} Response object
 */
function sendNotFound(res, message = 'Resource not found') {
  return sendError(res, message, 404);
}

/**
 * Send a 500 Internal Server Error
 *
 * @param {Object} res - Response object
 * @param {Error|string} error - Error object or message
 * @returns {Object} Response object
 */
function sendServerError(res, error) {
  const message = error instanceof Error ? error.message : error;
  console.error('Server error:', error);
  return sendError(res, 'Internal server error', 500);
}

/**
 * Send detailed error response with structured logging
 * Use this for better debugging in development and production
 *
 * @param {Object} res - Response object
 * @param {string} context - Context where the error occurred (e.g., endpoint name)
 * @param {Error} error - Error object
 * @param {Object} req - Request object (optional) for logging request details
 * @param {number} statusCode - HTTP status code (default: 500)
 * @returns {Object} Response object
 */
function sendDetailedError(res, context, error, req = null, statusCode = 500) {
  // Structured error logging
  const errorLog = {
    timestamp: new Date().toISOString(),
    context,
    error: error?.message || String(error),
    stack: error?.stack,
  };

  // Add request details if provided
  if (req) {
    errorLog.request = {
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      user: req.user?.username,
    };

    // Only log body for non-sensitive operations (avoid logging passwords)
    if (req.method !== 'POST' || !req.url.includes('/login')) {
      errorLog.request.body = req.body;
    }
  }

  // Log full error details server-side
  console.error('API Error:', JSON.stringify(errorLog, null, 2));

  // Send sanitized error to client
  const response = {
    success: false,
    error: error?.message || 'Internal server error',
  };

  // Include details only in development mode
  if (process.env.NODE_ENV === 'development') {
    response.details = {
      context,
      stack: error?.stack,
    };
  }

  return res.status(statusCode).json(response);
}

/**
 * Handle method not allowed
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {string[]} allowedMethods - Array of allowed HTTP methods
 * @returns {Object} Response object
 */
function sendMethodNotAllowed(res, allowedMethods = []) {
  res.setHeader('Allow', allowedMethods.join(', '));
  return sendError(res, `Method not allowed. Allowed methods: ${allowedMethods.join(', ')}`, 405);
}

/**
 * Set CORS headers for response
 * Uses environment-based whitelisting for security
 *
 * @param {Object} res - Response object
 * @param {Object} req - Request object (optional, for origin checking)
 * @returns {Object} Response object
 */
function setCorsHeaders(res, req = null) {
  // Get allowed origins from environment variable or use defaults
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];

  const origin = req?.headers?.origin;

  // Development mode: allow all origins
  if (process.env.NODE_ENV === 'development') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  // Production mode: check whitelist
  else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    // No CORS header set = browser will block the request
    console.warn('CORS: Origin not allowed:', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  return res;
}

/**
 * Handle OPTIONS request for CORS preflight
 *
 * @param {Object} res - Response object
 * @returns {Object} Response object
 */
function handleCorsPreflightRequest(res) {
  setCorsHeaders(res);
  return res.status(200).end();
}

module.exports = {
  sendSuccess,
  sendError,
  sendBadRequest,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendServerError,
  sendDetailedError,
  sendMethodNotAllowed,
  setCorsHeaders,
  handleCorsPreflightRequest
};
