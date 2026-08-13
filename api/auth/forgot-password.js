const { getDb } = require('../../lib/db');
const { sendPasswordResetEmail } = require('../../lib/email');
const { consumeRateLimit } = require('../../lib/rate-limit');
const { sendBadRequest, sendError, setCorsHeaders } = require('../../lib/response');
const crypto = require('crypto');

/**
 * The single response every non-rate-limited outcome returns.
 *
 * Password reset must not disclose whether an account exists, so "sent", "no such user",
 * "user has no email" and "send failed" are indistinguishable to the caller. Each case is
 * logged server-side with its real reason.
 */
const GENERIC_RESPONSE =
  'If an account matches that username or email, password reset instructions have been sent to it.';

module.exports = async (req, res) => {
  // Set CORS headers
  setCorsHeaders(res, req);

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return sendError(res, 'Method not allowed', 405);
  }

  try {
    const { identifier } = req.body; // Username or email

    // Input validation
    if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
      return sendBadRequest(res, 'Username or email is required');
    }

    const sanitizedIdentifier = identifier.trim().toLowerCase();
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Rate limiting - IP based
    // Development: 1000 requests per 24h (very tolerant for testing)
    // Production: 10 requests per 24h
    const isDev = process.env.NODE_ENV === 'development';
    const ipLimit = isDev ? 1000 : 10;

    const ipRateLimit = await consumeRateLimit(clientIp, 'password_reset_ip', ipLimit);
    if (!ipRateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Too many password reset requests. Please try again later.',
        retryAfter: ipRateLimit.retryAfter
      });
    }

    const db = await getDb();

    // Find user by username OR email
    const user = await db.collection('users').findOne({
      $or: [
        { username: sanitizedIdentifier },
        { email: sanitizedIdentifier }
      ],
      active: true
    });

    // Never reveal whether an account exists, or whether it has an email on file: both
    // outcomes return the same success response an actual send does. The reason is logged
    // server-side only.
    if (!user || !user.email) {
      console.log('[PASSWORD_RESET] No email sent:', {
        identifier: sanitizedIdentifier,
        reason: user ? 'no_email_registered' : 'user_not_found'
      });
      return res.status(200).json({ success: true, message: GENERIC_RESPONSE });
    }

    // Rate limiting - User based
    // Development: 100 requests per 24h (very tolerant for testing)
    // Production: 3 requests per 24h
    const userLimit = isDev ? 100 : 3;

    // Per-user cap stops mailbox flooding. It returns the generic response rather than a 429,
    // because a 429 here would itself confirm the account exists.
    const userRateLimit = await consumeRateLimit(user._id.toString(), 'password_reset_user', userLimit);
    if (!userRateLimit.allowed) {
      console.log('[PASSWORD_RESET] No email sent:', {
        identifier: sanitizedIdentifier,
        reason: 'user_rate_limited'
      });
      return res.status(200).json({ success: true, message: GENERIC_RESPONSE });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + (parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRY) || 3600) * 1000);

    // Store token in database
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          reset_token: resetToken,
          reset_token_expires_at: expiresAt,
          reset_token_created_at: new Date()
        }
      }
    );

    // Send email
    try {
      await sendPasswordResetEmail(
        user.email,
        user.username,
        resetToken,
        user.language || 'en'
      );

      console.log('[PASSWORD_RESET] Email sent successfully:', {
        username: user.username,
        email: user.email,
        ip: clientIp
      });

      return res.status(200).json({ success: true, message: GENERIC_RESPONSE });
    } catch (emailError) {
      // A delivery failure is only observable for accounts that exist, so it too returns the
      // generic response. Operators find these in the logs.
      console.error('[PASSWORD_RESET] Email sending failed:', emailError);
      return res.status(200).json({ success: true, message: GENERIC_RESPONSE });
    }

  } catch (error) {
    console.error('[PASSWORD_RESET] Error:', error);
    return sendError(res, 'Failed to process password reset request', 500);
  }
};
