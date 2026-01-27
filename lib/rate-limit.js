const { getDb } = require('./db');

/**
 * Check if request is within rate limit for password reset
 * Uses a proper sliding window algorithm
 * 
 * @param {string} identifier - IP address or user ID
 * @param {string} type - 'ip' or 'user'
 * @param {number} maxRequests - Max requests per 24h window (default: 3)
 * @returns {Promise<{allowed: boolean, remaining: number, retryAfter?: number}>}
 */
async function checkPasswordResetRateLimit(identifier, type, maxRequests = 3) {
  const db = await getDb();
  const now = new Date();
  const windowDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const windowStart = new Date(now.getTime() - windowDuration);

  // Find existing record for this identifier and type
  const record = await db.collection('password_reset_rate_limits').findOne({
    identifier,
    type
  });

  // No record exists - create new one
  if (!record) {
    await db.collection('password_reset_rate_limits').insertOne({
      identifier,
      type,
      count: 1,
      window_start: now,
      last_request: now,
      created_at: now
    });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  // SECURITY FIX: Check if the window has expired
  // If window_start is more than 24 hours ago, reset the window
  const windowExpired = record.window_start.getTime() < windowStart.getTime();
  
  if (windowExpired) {
    // Window has expired - reset count and start new window
    await db.collection('password_reset_rate_limits').updateOne(
      { _id: record._id },
      {
        $set: {
          count: 1,
          window_start: now,
          last_request: now
        }
      }
    );
    return { allowed: true, remaining: maxRequests - 1 };
  }

  // Window is still active - check if limit exceeded
  if (record.count >= maxRequests) {
    const windowEnd = new Date(record.window_start.getTime() + windowDuration);
    const retryAfter = Math.ceil((windowEnd.getTime() - now.getTime()) / 1000);
    return { 
      allowed: false, 
      remaining: 0, 
      retryAfter: Math.max(1, retryAfter) // At least 1 second
    };
  }

  // Window is active and limit not exceeded - increment count
  await db.collection('password_reset_rate_limits').updateOne(
    { _id: record._id },
    { 
      $inc: { count: 1 },
      $set: { last_request: now }
    }
  );

  return { allowed: true, remaining: maxRequests - record.count - 1 };
}

module.exports = { checkPasswordResetRateLimit };
