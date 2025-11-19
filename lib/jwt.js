/**
 * JWT Authentication Utilities
 *
 * Provides JWT token generation and verification for secure authentication.
 * Replaces the insecure username-as-token system.
 */

const jwt = require('jsonwebtoken');

// Get JWT configuration from environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

// Warn if JWT_SECRET is not set
if (!JWT_SECRET) {
  console.warn('⚠️  WARNING: JWT_SECRET not set in environment variables. Using insecure default for development only!');
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

  return jwt.sign(payload, JWT_SECRET || 'INSECURE_DEV_SECRET_CHANGE_IN_PRODUCTION', {
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
    return jwt.verify(token, JWT_SECRET || 'INSECURE_DEV_SECRET_CHANGE_IN_PRODUCTION', {
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
