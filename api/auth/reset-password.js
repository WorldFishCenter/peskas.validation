const { getDb } = require('../../lib/db');
const { sendSuccess, sendBadRequest, sendError, setCorsHeaders } = require('../../lib/response');
const { isValidResetToken, validatePassword } = require('../../lib/helpers');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  // Set CORS headers
  setCorsHeaders(res, req);

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return sendError(res, 'Method not allowed', 405);
  }

  try {
    const { token, newPassword, confirmPassword } = req.body;

    // Input validation. The token format check must run before the value reaches the query:
    // an object body such as {"token": {"$gt": ""}} would otherwise be interpreted as a
    // MongoDB operator and match the first user holding any reset token.
    if (!isValidResetToken(token)) {
      return sendBadRequest(res, 'Invalid or expired reset token');
    }

    if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
      return sendBadRequest(res, 'All fields are required');
    }

    if (newPassword !== confirmPassword) {
      return sendBadRequest(res, 'Passwords do not match');
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return sendBadRequest(res, passwordError);
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({
      reset_token: token,
      active: true
    });

    if (!user) {
      return sendBadRequest(res, 'Invalid or expired reset token');
    }

    // Check token expiration. A token row with no expiry is treated as expired rather than
    // as never-expiring.
    if (!user.reset_token_expires_at || new Date() > user.reset_token_expires_at) {
      return sendBadRequest(res, 'Reset token has expired');
    }

    // Hash new password
    const password_hash = await bcrypt.hash(newPassword, 10);

    // Update password and invalidate token
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          password_hash,
          updated_at: new Date(),
          updated_by: 'password_reset'
        },
        $unset: {
          reset_token: '',
          reset_token_expires_at: '',
          reset_token_created_at: ''
        }
      }
    );

    console.log('[PASSWORD_RESET_COMPLETE]', {
      username: user.username,
      timestamp: new Date().toISOString()
    });

    return sendSuccess(res, {
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.'
    });

  } catch (error) {
    console.error('[RESET_PASSWORD] Error:', error);
    return sendError(res, 'Failed to reset password', 500);
  }
};
