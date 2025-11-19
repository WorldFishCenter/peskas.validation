/**
 * POST /api/auth/login
 *
 * Authenticate user with username and password
 * Returns user object on successful login
 */

const bcrypt = require('bcryptjs');
const { getDb } = require('../../lib/db');
const { generateToken } = require('../../lib/jwt');
const { sendSuccess, sendBadRequest, sendUnauthorized, sendServerError, setCorsHeaders } = require('../../lib/response');
const { isValidUsername, sanitizeString } = require('../../lib/api-utils');

module.exports = async function handler(req, res) {
  // Set CORS headers
  setCorsHeaders(res, req);

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username: rawUsername, password } = req.body;

    // Validate input types
    if (!rawUsername || typeof rawUsername !== 'string' || !password || typeof password !== 'string') {
      return sendBadRequest(res, 'Username and password required');
    }

    // Sanitize username
    const username = sanitizeString(rawUsername, 50).toLowerCase();

    // Validate username format
    if (!isValidUsername(username)) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    // Validate password length (don't sanitize passwords!)
    if (password.length < 1 || password.length > 200) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    // Get database connection
    const database = await getDb();
    if (!database) {
      console.error('Database not configured');
      return sendServerError(res, 'Authentication system not configured');
    }

    // Find user by username
    const user = await database.collection('users').findOne({
      username: username
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    // Check if user is active
    if (!user.active) {
      return res.status(401).json({ success: false, error: 'Account is disabled' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = generateToken(user);

    // Update last_login timestamp
    await database.collection('users').updateOne(
      { _id: user._id },
      { $set: { last_login: new Date() } }
    );

    // Return user object (exclude password_hash) and JWT token
    const userResponse = {
      id: user._id.toString(),
      username: user.username,
      name: user.name,
      country: user.country,
      role: user.role,
      active: user.active,
      permissions: user.permissions,
      created_at: user.created_at,
      last_login: new Date()
    };

    return res.status(200).json({
      success: true,
      token,
      user: userResponse,
      expiresIn: process.env.JWT_EXPIRY || '7d'
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Login failed' });
  }
};
