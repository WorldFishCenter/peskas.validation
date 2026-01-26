const { getDb } = require('../../lib/db');
const { sendError, setCorsHeaders } = require('../../lib/response');
const crypto = require('crypto');

module.exports = async (req, res) => {
  // Set CORS headers
  setCorsHeaders(res, req);

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return sendError(res, 'Method not allowed', 405);
  }

  try {
    const startTime = Date.now();
    const { token } = req.query;

    if (!token || typeof token !== 'string' || token.length !== 64) {
      // Invalid token format - still apply timing delay
      await applyTimingDelay(startTime);
      return res.status(200).json({
        success: true,
        valid: false,
        reason: 'invalid'
      });
    }

    const db = await getDb();
    
    // SECURITY: Query for all active users with non-expired tokens
    // This prevents the database query timing from leaking information
    const now = new Date();
    const users = await db.collection('users').find({
      reset_token: { $exists: true, $ne: null },
      reset_token_expires_at: { $gte: now },
      active: true
    }, {
      projection: { username: 1, reset_token: 1, reset_token_expires_at: 1 }
    }).limit(100).toArray(); // Limit to prevent DoS

    let matchedUser = null;
    const tokenBuffer = Buffer.from(token, 'utf8');
    
    // SECURITY: Use constant-time comparison for all potential matches
    for (const user of users) {
      if (user.reset_token) {
        const storedTokenBuffer = Buffer.from(user.reset_token, 'utf8');
        
        // Pad buffers to same length for constant-time comparison
        const maxLength = Math.max(tokenBuffer.length, storedTokenBuffer.length);
        const paddedToken = Buffer.alloc(maxLength);
        const paddedStored = Buffer.alloc(maxLength);
        tokenBuffer.copy(paddedToken);
        storedTokenBuffer.copy(paddedStored);
        
        try {
          if (crypto.timingSafeEqual(paddedToken, paddedStored)) {
            matchedUser = user;
            // Don't break - continue checking all to maintain constant time
          }
        } catch (e) {
          // Length mismatch or other error - continue
        }
      }
    }

    // Apply consistent timing delay before responding
    await applyTimingDelay(startTime);

    if (!matchedUser) {
      return res.status(200).json({
        success: true,
        valid: false,
        reason: 'invalid'
      });
    }

    // Double-check expiration (should be caught by query, but verify)
    if (new Date() > matchedUser.reset_token_expires_at) {
      return res.status(200).json({
        success: true,
        valid: false,
        reason: 'expired'
      });
    }

    return res.status(200).json({
      success: true,
      valid: true,
      username: matchedUser.username
    });

  } catch (error) {
    console.error('[VALIDATE_TOKEN] Error:', error);
    return sendError(res, 'Failed to validate token', 500);
  }
};

/**
 * Apply consistent timing delay to prevent timing attacks
 * Ensures all requests take at least 100ms
 * 
 * @param {number} startTime - Request start time in milliseconds
 * @returns {Promise<void>}
 */
async function applyTimingDelay(startTime) {
  const minDuration = 100; // Minimum 100ms response time
  const elapsed = Date.now() - startTime;
  const delay = Math.max(0, minDuration - elapsed);

  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
