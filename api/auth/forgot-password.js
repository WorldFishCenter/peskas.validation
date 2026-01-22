const { getDb } = require('../../lib/db');
const { sendPasswordResetEmail } = require('../../lib/email');
const { checkPasswordResetRateLimit } = require('../../lib/rate-limit');
const { sendSuccess, sendBadRequest, sendError, setCorsHeaders } = require('../../lib/response');
const crypto = require('crypto');

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

    const ipRateLimit = await checkPasswordResetRateLimit(clientIp, 'ip', ipLimit);
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

    // SECURITY: Always return success to prevent email enumeration
    const genericSuccess = {
      success: true,
      message: 'If an account with that username/email exists and has a registered email, password reset instructions have been sent.'
    };

    // Early return if user not found (but don't tell the client)
    if (!user) {
      console.log('[PASSWORD_RESET] User not found:', sanitizedIdentifier);
      return res.status(200).json(genericSuccess);
    }

    // Early return if no email (but don't tell the client)
    if (!user.email) {
      console.log('[PASSWORD_RESET] User has no email:', user.username);
      return res.status(200).json(genericSuccess);
    }

    // Rate limiting - User based
    // Development: 100 requests per 24h (very tolerant for testing)
    // Production: 3 requests per 24h
    const userLimit = isDev ? 100 : 3;

    const userRateLimit = await checkPasswordResetRateLimit(user._id.toString(), 'user', userLimit);
    if (!userRateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Too many password reset requests. Please try again later.',
        retryAfter: userRateLimit.retryAfter
      });
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
    } catch (emailError) {
      console.error('[PASSWORD_RESET] Email sending failed:', emailError);
      // Don't reveal email failure to prevent enumeration
      // Log for admin monitoring
    }

    return res.status(200).json(genericSuccess);

  } catch (error) {
    console.error('[PASSWORD_RESET] Error:', error);
    return sendError(res, 'Failed to process password reset request', 500);
  }
};
