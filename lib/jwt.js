/**
 * JWT Authentication Utilities
 *
 * Provides JWT token generation and verification for secure authentication.
 * Replaces the insecure username-as-token system.
 */

const jwt = require('jsonwebtoken');

// Get JWT configuration from environment variables
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

/**
 * Development-only signing key.
 *
 * This constant is committed, so any token signed with it is forgeable by anyone reading the
 * repository. Falling back to it in production would let an attacker mint an admin token, so
 * a missing JWT_SECRET is a hard failure there rather than a warning.
 */
const DEV_FALLBACK_SECRET = 'INSECURE_DEV_SECRET_CHANGE_IN_PRODUCTION';

function resolveSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET is not set. Refusing to sign or verify tokens with the public development key.'
    );
  }
  return DEV_FALLBACK_SECRET;
}

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  WARNING: JWT_SECRET not set. Using the public development key — never deploy this way.');
}

/**
 * Generate a JWT token for a user
 *
 * @param {Object} user - User object from database
 * @returns {string} Signed JWT token
 */
function generateToken(user) {
  const payload = {
    id: user._id.toString(),
    username: user.username,
    role: user.role,
    permissions: user.permissions
  };

  return jwt.sign(payload, resolveSecret(), {
    expiresIn: JWT_EXPIRY,
    issuer: 'validation-portal'
  });
}

/**
 * Verify and decode a JWT token
 *
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, resolveSecret(), {
      issuer: 'validation-portal'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

module.exports = {
  generateToken,
  verifyToken
};
