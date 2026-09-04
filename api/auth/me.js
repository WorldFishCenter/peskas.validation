/**
 * GET /api/auth/me
 *
 * Get current authenticated user information
 * Requires authentication
 */

const { withMiddleware } = require('../../lib/middleware');
const { sendServerError } = require('../../lib/response');

async function handler(req, res) {
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
module.exports = withMiddleware(handler, { methods: ['GET'] });
