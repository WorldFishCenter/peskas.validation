/**
 * PATCH /api/users/:id/reset-password
 *
 * Reset user password (Admin only)
 * Requires authentication + admin role
 */

const bcrypt = require('bcryptjs');
const { withMiddleware, authenticateUser, requireAdmin } = require('../../../lib/middleware');
const { getDb } = require('../../../lib/db');
const { validateObjectId } = require('../../../lib/helpers');
const { setCorsHeaders } = require('../../../lib/response');

async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user ID from query parameter (Vercel converts [id] to query.id)
    const id = req.query.id;
    const { newPassword } = req.body;

    // Validate ObjectId before using it
    const userId = validateObjectId(id, 'User ID');

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    const database = await getDb();
    if (!database) {
      return res.status(500).json({
        success: false,
        message: 'Database not configured'
      });
    }

    // Hash the new password
    const password_hash = await bcrypt.hash(newPassword, 10);

    // Update the password
    const result = await database.collection('users').updateOne(
      { _id: userId },
      {
        $set: {
          password_hash,
          updated_at: new Date(),
          updated_by: req.user.username
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);

    // Return 400 for validation errors
    if (error.message && (error.message.includes('Invalid') || error.message.includes('required'))) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
}

module.exports = withMiddleware(handler, authenticateUser, requireAdmin);
