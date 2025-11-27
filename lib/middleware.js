/**
 * Authentication and Authorization Middleware for Vercel Serverless Functions
 *
 * This module provides middleware functions for authenticating users and
 * authorizing admin-only operations. Works with both Express and Vercel handlers.
 */

const { getDb } = require('./db');
const { verifyToken } = require('./jwt');

/**
 * Authenticate user based on JWT Bearer token
 *
 * This middleware validates the JWT token and attaches user information to req.user.
 * The token is verified using the JWT_SECRET environment variable.
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 * @returns {Promise<void>}
 */
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return res.status(401).json({
        error: 'Invalid authentication',
        code: error.message.includes('expired') ? 'TOKEN_EXPIRED' : 'AUTH_INVALID',
        message: error.message
      });
    }

    // Attach decoded user information to request
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      permissions: decoded.permissions
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Require admin role (must be used after authenticateUser)
 *
 * This middleware checks if the authenticated user has admin role.
 * Returns 403 Forbidden if user is not an admin.
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 * @returns {void}
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Wrapper for serverless functions to apply middleware
 *
 * This helper allows using Express-style middleware with Vercel serverless functions.
 *
 * @param {Function} handler - The main handler function
 * @param {...Function} middlewares - Middleware functions to apply
 * @returns {Function} Wrapped handler function
 */
function withMiddleware(handler, ...middlewares) {
  return async (req, res) => {
    try {
      // Apply middleware chain
      for (const middleware of middlewares) {
        await new Promise((resolve, reject) => {
          middleware(req, res, (error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }

      // Execute main handler
      return await handler(req, res);
    } catch (error) {
      console.error('Middleware error:', error);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

module.exports = {
  authenticateUser,
  requireAdmin,
  withMiddleware
};
