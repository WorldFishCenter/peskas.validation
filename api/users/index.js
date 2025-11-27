/**
 * GET/POST /api/users
 *
 * List all users (GET) or create new user (POST)
 * Requires authentication + admin role
 */

const bcrypt = require('bcryptjs');
const { withMiddleware, authenticateUser, requireAdmin } = require('../../lib/middleware');
const { getDb } = require('../../lib/db');
const { sendBadRequest, sendServerError, setCorsHeaders } = require('../../lib/response');

async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return await handleGet(req, res);
  } else if (req.method === 'POST') {
    return await handlePost(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req, res) {
  try {
    const database = await getDb();
    if (!database) {
      return sendServerError(res, 'Database not configured');
    }

    const users = await database.collection('users')
      .find({}, { projection: { password_hash: 0 } })
      .sort({ created_at: -1 })
      .toArray();

    return res.json({
      success: true,
      users: users.map(user => ({
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
      }))
    });
  } catch (error) {
    console.error('Get users error:', error);
    return sendServerError(res, 'Failed to fetch users');
  }
}

async function handlePost(req, res) {
  try {
    const { username, name, password, country, role, permissions } = req.body;

    // Validation
    if (!username || username.length < 3) {
      return sendBadRequest(res, 'Username must be at least 3 characters');
    }

    if (!password || password.length < 8) {
      return sendBadRequest(res, 'Password must be at least 8 characters');
    }

    if (!role || !['admin', 'user'].includes(role)) {
      return sendBadRequest(res, 'Role must be admin or user');
    }

    const database = await getDb();
    if (!database) {
      return sendServerError(res, 'Database not configured');
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user document
    const newUser = {
      username: username.trim().toLowerCase(),
      password_hash,
      role,
      active: true,
      created_at: new Date(),
      created_by: req.user.username,
      last_login: null
    };

    // Add optional fields
    if (name && name.trim()) {
      newUser.name = name.trim();
    }

    if (country && Array.isArray(country) && country.length > 0) {
      newUser.country = country;
    }

    if (permissions) {
      newUser.permissions = permissions;
    }

    // Insert user
    const result = await database.collection('users').insertOne(newUser);

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: result.insertedId.toString(),
        username: newUser.username,
        name: newUser.name,
        country: newUser.country,
        role: newUser.role,
        active: newUser.active,
        permissions: newUser.permissions,
        created_at: newUser.created_at,
        created_by: newUser.created_by
      }
    });
  } catch (error) {
    console.error('Create user error:', error);

    if (error.code === 11000) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    return sendServerError(res, 'Failed to create user');
  }
}

module.exports = withMiddleware(handler, authenticateUser, requireAdmin);
