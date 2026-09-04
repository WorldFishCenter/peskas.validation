/**
 * GET/POST /api/users
 *
 * List all users (GET) or create new user (POST)
 * Requires authentication + admin role
 */

const bcrypt = require('bcryptjs');
const { withMiddleware } = require('../../lib/middleware');
const { logAuditEvent } = require('../../lib/audit-logger');
const { validatePassword } = require('../../lib/helpers');
const { sendBadRequest, sendServerError } = require('../../lib/response');

async function handler(req, res) {
  if (req.method === 'GET') {
    return await handleGet(req, res);
  } else if (req.method === 'POST') {
    return await handlePost(req, res);
  }
}

async function handleGet(req, res) {
  try {
    const database = req.db;
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
    if (typeof username !== 'string' || username.length < 3) {
      return sendBadRequest(res, 'Username must be at least 3 characters');
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return sendBadRequest(res, passwordError);
    }

    if (!role || !['admin', 'user'].includes(role)) {
      return sendBadRequest(res, 'Role must be admin or user');
    }

    const database = req.db;
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

    // Awaited before responding: Vercel freezes the context after res.json().
    await logAuditEvent(database, {
      username: req.user.username,
      user_id: req.user.id,
      category: 'admin',
      action: 'user_created',
      status: 'success',
      details: { target_user_id: result.insertedId.toString(), target_username: newUser.username, role: newUser.role },
      req
    });

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

module.exports = withMiddleware(handler, { methods: ['GET', 'POST'], admin: true });
