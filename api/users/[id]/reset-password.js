/**
 * PATCH /api/users/:id/reset-password
 *
 * Reset user password (Admin only)
 * Requires authentication + admin role
 */

const bcrypt = require('bcryptjs');
const { withMiddleware } = require('../../../lib/middleware');
const { validateObjectId, validatePassword } = require('../../../lib/helpers');
const { HttpError } = require('../../../lib/response');
const { logAuditEvent } = require('../../../lib/audit-logger');

async function handler(req, res) {
  // Get user ID from query parameter (Vercel converts [id] to query.id)
  const id = req.query.id;
  const { newPassword } = req.body;

  // Validate ObjectId before using it
  const userId = validateObjectId(id, 'User ID');

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    throw new HttpError(passwordError, 400);
  }

  const database = req.db;

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
    throw new HttpError('User not found', 404);
  }

  // An admin changing another account's password is exactly the kind of action the audit
  // log exists for. Awaited before responding: Vercel freezes the context after the
  // response, so a fire-and-forget write is dropped.
  await logAuditEvent(database, {
    username: req.user.username,
    user_id: req.user.id,
    category: 'admin',
    action: 'user_password_reset',
    status: 'success',
    details: { target_user_id: userId.toString() },
    req
  });

  return res.json({
    success: true,
    message: 'Password reset successfully'
  });
}

module.exports = withMiddleware(handler, { methods: ['PATCH'], admin: true });
