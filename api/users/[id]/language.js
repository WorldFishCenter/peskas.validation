/**
 * PATCH /api/users/:id/language
 *
 * Update user language preference
 * Requires authentication (users can update their own language, admins can update any)
 */

const { withMiddleware } = require('../../../lib/middleware');
const { validateObjectId } = require('../../../lib/helpers');
const { sendNotFound, sendBadRequest, sendServerError, sendUnauthorized } = require('../../../lib/response');

// Supported language codes
const VALID_LANGUAGES = ['en', 'pt', 'sw'];

async function handler(req, res) {
  try {
    // Get user ID from query parameter (Vercel converts [id] to query.id)
    const id = req.query.id;
    const { language } = req.body;

    // Validate ObjectId before using it
    const userId = validateObjectId(id, 'User ID');

    // Validate language code
    if (!language || typeof language !== 'string') {
      return sendBadRequest(res, 'Language code is required');
    }

    if (!VALID_LANGUAGES.includes(language)) {
      return sendBadRequest(res, `Invalid language code. Must be one of: ${VALID_LANGUAGES.join(', ')}`);
    }

    // Authorization: Users can update their own language, admins can update any
    const requestingUserId = req.user.id || req.user._id?.toString();
    const targetUserId = userId.toString();
    const isAdmin = req.user.role === 'admin';

    if (requestingUserId !== targetUserId && !isAdmin) {
      return sendUnauthorized(res, 'You can only update your own language preference');
    }

    const database = req.db;
    // Update user language
    const result = await database.collection('users').findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          language: language,
          updated_at: new Date()
        }
      },
      { returnDocument: 'after', projection: { password_hash: 0 } }
    );

    // findOneAndUpdate returns the document itself, not a { value } wrapper. Guarding on
    // `result.value` made every successful language change respond 404.
    if (!result) {
      return sendNotFound(res, 'User not found');
    }

    const updatedUser = result;

    return res.json({
      success: true,
      language: updatedUser.language,
      user: {
        id: updatedUser._id.toString(),
        username: updatedUser.username,
        language: updatedUser.language
      }
    });
  } catch (error) {
    console.error('Update language error:', error);

    // Return 400 for validation errors
    return sendServerError(res, 'Failed to update language preference');
  }
}

module.exports = withMiddleware(handler, { methods: ['PATCH'] });
