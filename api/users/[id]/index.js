/**
 * GET/PATCH/DELETE /api/users/:id
 *
 * Get, update, or delete a single user
 * Requires authentication + admin role
 */

const bcrypt = require('bcryptjs');
const { withMiddleware, authenticateUser, requireAdmin } = require('../../../lib/middleware');
const { getDb } = require('../../../lib/db');
const { validateObjectId } = require('../../../lib/helpers');
const { sendNotFound, sendBadRequest, sendServerError, setCorsHeaders } = require('../../../lib/response');

async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get user ID from query parameter (Vercel converts [id] to query.id)
  const id = req.query.id;

  if (req.method === 'GET') {
    return await handleGet(req, res, id);
  } else if (req.method === 'PATCH') {
    return await handlePatch(req, res, id);
  } else if (req.method === 'DELETE') {
    return await handleDelete(req, res, id);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req, res, id) {
  try {
    // Validate ObjectId before using it
    const userId = validateObjectId(id, 'User ID');

    const database = await getDb();
    if (!database) {
      return sendServerError(res, 'Database not configured');
    }

    const user = await database.collection('users').findOne(
      { _id: userId },
      { projection: { password_hash: 0 } }
    );

    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    return res.json({
      success: true,
      user: {
        _id: user._id.toString(),
        username: user.username,
        name: user.name,
        country: user.country,
        role: user.role,
        active: user.active,
        permissions: user.permissions,
        created_at: user.created_at,
        created_by: user.created_by,
        last_login: user.last_login
      }
    });
  } catch (error) {
    console.error('Get user error:', error);

    // Return 400 for validation errors
    if (error.message && (error.message.includes('Invalid') || error.message.includes('required'))) {
      return sendBadRequest(res, error.message);
    }

    return sendServerError(res, 'Failed to fetch user');
  }
}

async function handlePatch(req, res, id) {
  try {
    // Validate ObjectId before using it
    const userId = validateObjectId(id, 'User ID');

    const { name, country, role, active, password } = req.body;

    const database = await getDb();
    if (!database) {
      return sendServerError(res, 'Database not configured');
    }

    // Get existing user to check role changes
    const existingUser = await database.collection('users').findOne({ _id: userId });
    if (!existingUser) {
      return sendNotFound(res, 'User not found');
    }

    // Build update object
    const updateDoc = {
      updated_at: new Date(),
      updated_by: req.user.username
    };

    const unsetDoc = {};

    if (name !== undefined) {
      updateDoc.name = name.trim();
    }

    if (country !== undefined) {
      updateDoc.country = country;
    }

    const newRole = role !== undefined ? role : existingUser.role;

    if (role !== undefined) {
      if (!['admin', 'user'].includes(role)) {
        return sendBadRequest(res, 'Role must be admin or user');
      }
      updateDoc.role = role;
    }

    // Handle country field based on role
    if (country !== undefined) {
      if (newRole === 'viewer') {
        if (country.length < 2) {
          return sendBadRequest(res, 'Country code required for viewer role');
        }
        updateDoc.country = country.trim().toLowerCase();
      } else if (newRole === 'admin') {
        // Admins should not have country field - remove it
        unsetDoc.country = '';
      }
    } else if (role === 'admin' && existingUser.country) {
      // If changing to admin role and user has country, remove it
      unsetDoc.country = '';
    } else if (role === 'viewer' && !existingUser.country && !country) {
      return sendBadRequest(res, 'Country code required when changing to viewer role');
    }

    if (active !== undefined) {
      updateDoc.active = Boolean(active);
    }

    if (password) {
      if (password.length < 8) {
        return sendBadRequest(res, 'Password must be at least 8 characters');
      }
      updateDoc.password_hash = await bcrypt.hash(password, 10);
    }

    // Note: Permissions are managed through Airtable sync only
    // Do not allow manual permission updates via this endpoint

    // Update user
    const updateQuery = { $set: updateDoc };
    if (Object.keys(unsetDoc).length > 0) {
      updateQuery.$unset = unsetDoc;
    }

    const result = await database.collection('users').findOneAndUpdate(
      { _id: userId },
      updateQuery,
      { returnDocument: 'after', projection: { password_hash: 0 } }
    );

    const updatedUser = result.value || result;

    if (!updatedUser) {
      return sendNotFound(res, 'User not found');
    }

    return res.json({
      success: true,
      user: {
        _id: updatedUser._id.toString(),
        username: updatedUser.username,
        name: updatedUser.name,
        country: updatedUser.country,
        role: updatedUser.role,
        active: updatedUser.active,
        permissions: updatedUser.permissions,
        created_at: updatedUser.created_at,
        created_by: updatedUser.created_by,
        last_login: updatedUser.last_login,
        updated_at: updatedUser.updated_at,
        updated_by: updatedUser.updated_by
      }
    });
  } catch (error) {
    console.error('Update user error:', error);

    // Return 400 for validation errors
    if (error.message && (error.message.includes('Invalid') || error.message.includes('required'))) {
      return sendBadRequest(res, error.message);
    }

    if (error.code === 11000) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    return sendServerError(res, 'Failed to update user');
  }
}

async function handleDelete(req, res, id) {
  try {
    // Validate ObjectId before using it
    const userId = validateObjectId(id, 'User ID');

    const database = await getDb();
    if (!database) {
      return sendServerError(res, 'Database not configured');
    }

    // Prevent deleting yourself
    if (id === req.user.id) {
      return sendBadRequest(res, 'Cannot delete your own account');
    }

    const result = await database.collection('users').deleteOne({ _id: userId });

    if (result.deletedCount === 0) {
      return sendNotFound(res, 'User not found');
    }

    return res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);

    // Return 400 for validation errors
    if (error.message && (error.message.includes('Invalid') || error.message.includes('required'))) {
      return sendBadRequest(res, error.message);
    }

    return sendServerError(res, 'Failed to delete user');
  }
}

module.exports = withMiddleware(handler, authenticateUser, requireAdmin);
