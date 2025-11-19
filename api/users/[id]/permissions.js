/**
 * PATCH /api/users/:id/permissions
 *
 * Update user survey permissions (Admin only)
 * Requires authentication + admin role
 */

const { withMiddleware, authenticateUser, requireAdmin } = require('../../../lib/middleware');
const { getDb } = require('../../../lib/db');
const { validateObjectId } = require('../../../lib/helpers');
const { sendNotFound, sendBadRequest, sendServerError, setCorsHeaders } = require('../../../lib/response');

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
    const { surveys } = req.body;

    // Validate ObjectId before using it
    const userId = validateObjectId(id, 'User ID');

    if (!Array.isArray(surveys)) {
      return sendBadRequest(res, 'Surveys must be an array of asset_ids');
    }

    const database = await getDb();
    if (!database) {
      return sendServerError(res, 'Database not configured');
    }

    // Validate that all survey asset_ids exist
    if (surveys.length > 0) {
      const existingSurveys = await database.collection('surveys').find({
        asset_id: { $in: surveys }
      }).toArray();

      if (existingSurveys.length !== surveys.length) {
        return res.status(400).json({
          error: 'One or more survey asset_ids do not exist',
          found: existingSurveys.map(s => s.asset_id),
          requested: surveys
        });
      }
    }

    // Update user permissions
    const result = await database.collection('users').findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          'permissions.surveys': surveys,
          updated_at: new Date(),
          updated_by: req.user.username
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
      user: {
        id: updatedUser._id.toString(),
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        permissions: updatedUser.permissions,
        updated_at: updatedUser.updated_at,
        updated_by: updatedUser.updated_by
      }
    });
  } catch (error) {
    console.error('Update permissions error:', error);

    // Return 400 for validation errors
    if (error.message && (error.message.includes('Invalid') || error.message.includes('required'))) {
      return sendBadRequest(res, error.message);
    }

    return sendServerError(res, 'Failed to update permissions');
  }
}

module.exports = withMiddleware(handler, authenticateUser, requireAdmin);
