/**
 * GET /api/auth/me
 *
 * Get current authenticated user information
 * Requires authentication
 */

const { withMiddleware, authenticateUser } = require('../../lib/middleware');
const { sendSuccess, sendServerError, setCorsHeaders } = require('../../lib/response');

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
    return res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return sendServerError(res, 'Failed to get user');
  }
}

// Export with authentication middleware
module.exports = withMiddleware(handler, authenticateUser);
