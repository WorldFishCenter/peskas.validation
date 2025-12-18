/**
 * PATCH /api/users/:id/language
 *
 * Update user language preference
 * Requires authentication (users can update their own language, admins can update any)
 */

const { withMiddleware, authenticateUser } = require('../../../lib/middleware');
const { getDb } = require('../../../lib/db');
const { validateObjectId } = require('../../../lib/helpers');
const { sendNotFound, sendBadRequest, sendServerError, sendUnauthorized, setCorsHeaders } = require('../../../lib/response');

// Supported language codes
const VALID_LANGUAGES = ['en', 'pt', 'sw'];

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

    const database = await getDb();
    if (!database) {
      return sendServerError(res, 'Database not configured');
    }

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

    if (!result || !result.value) {
      return sendNotFound(res, 'User not found');
    }

    const updatedUser = result.value || result;

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
    if (error.message && (error.message.includes('Invalid') || error.message.includes('required'))) {
      return sendBadRequest(res, error.message);
    }

    return sendServerError(res, 'Failed to update language preference');
  }
}

module.exports = withMiddleware(handler, authenticateUser);
