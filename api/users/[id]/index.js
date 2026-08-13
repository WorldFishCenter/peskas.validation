/**
 * GET/PATCH/DELETE /api/users/:id
 *
 * Get, update, or delete a single user
 * Requires authentication + admin role
 */

const bcrypt = require('bcryptjs');
const { withMiddleware, authenticateUser, requireAdmin } = require('../../../lib/middleware');
const { getDb } = require('../../../lib/db');
const { logAuditEvent } = require('../../../lib/audit-logger');
const { validateObjectId, validatePassword } = require('../../../lib/helpers');
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
      if (typeof name !== 'string') {
        return sendBadRequest(res, 'Name must be a string');
      }
      updateDoc.name = name.trim();
    }

    if (country !== undefined) {
      if (!Array.isArray(country)) {
        return sendBadRequest(res, 'Country must be an array of country codes');
      }
      updateDoc.country = country;
    }

    const newRole = role !== undefined ? role : existingUser.role;

    if (role !== undefined) {
      if (!['admin', 'user'].includes(role)) {
        return sendBadRequest(res, 'Role must be admin or user');
      }
      updateDoc.role = role;
    }

    // Handle country field based on role. Only 'admin' and 'user' are valid roles (validated
    // above), so the former 'viewer' branches here were unreachable — and one of them called
    // .trim() on `country`, which is an array everywhere else in the codebase.
    if (newRole === 'admin') {
      // Admins are not scoped to a country.
      unsetDoc.country = '';
      delete updateDoc.country;
    }

    if (active !== undefined) {
      updateDoc.active = Boolean(active);
    }

    if (password !== undefined) {
      const passwordError = validatePassword(password);
      if (passwordError) {
        return sendBadRequest(res, passwordError);
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

    // findOneAndUpdate returns the document itself, not a { value } wrapper.
    if (!result) {
      return sendNotFound(res, 'User not found');
    }

    const updatedUser = result;

    await logAuditEvent(database, {
      username: req.user.username,
      user_id: req.user.id,
      category: 'admin',
      action: 'user_updated',
      status: 'success',
      details: {
        target_user_id: updatedUser._id.toString(),
        target_username: updatedUser.username,
        // Field names only — never the new password, and no need for the values.
        fields: Object.keys(updateDoc).filter(k => k !== 'updated_at' && k !== 'updated_by')
          .map(k => (k === 'password_hash' ? 'password' : k))
      },
      req
    });

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

    // Read first so the audit record can name who was deleted, not just an id.
    const target = await database.collection('users').findOne({ _id: userId }, { projection: { username: 1, role: 1 } });

    const result = await database.collection('users').deleteOne({ _id: userId });

    if (result.deletedCount === 0) {
      return sendNotFound(res, 'User not found');
    }

    await logAuditEvent(database, {
      username: req.user.username,
      user_id: req.user.id,
      category: 'admin',
      action: 'user_deleted',
      status: 'success',
      details: { target_user_id: id, target_username: target?.username || null, role: target?.role || null },
      req
    });

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
