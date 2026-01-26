/**
 * Airtable Webhook Handler
 * Triggers sync when Airtable sends webhook notification
 *
 * Setup in Airtable:
 * 1. Go to base settings → Webhooks
 * 2. Add webhook URL: https://your-app.vercel.app/api/webhooks/airtable-sync
 * 3. Copy webhook secret to .env as AIRTABLE_WEBHOOK_SECRET
 * 4. Configure which tables to watch (validation, forms, districts)
 *
 * Security: Validates webhook signature from Airtable
 *
 * @module api/webhooks/airtable-sync
 */

const { spawn } = require('child_process');
const crypto = require('crypto');
const { setCorsHeaders } = require('../../lib/response');

/**
 * Map Airtable table names to sync scripts
 */
const SCRIPT_MAP = {
  validation: 'scripts/sync_users_from_airtable.js',
  forms: 'scripts/sync_surveys_from_airtable.js',
  districts: 'scripts/sync_districts_from_airtable.cjs'
};

/**
 * Map Airtable table names to entity types
 */
const ENTITY_MAP = {
  validation: 'users',
  forms: 'surveys',
  districts: 'districts'
};

/**
 * Verify webhook signature from Airtable
 *
 * @param {Object} payload - Request body
 * @param {string} signature - Signature from x-airtable-signature header
 * @returns {boolean} true if valid
 */
function verifyWebhookSignature(payload, signature) {
  const secret = process.env.AIRTABLE_WEBHOOK_SECRET;

  if (!secret) {
    console.warn('⚠️  AIRTABLE_WEBHOOK_SECRET not set, skipping signature verification');
    return true; // Allow in development if secret not set
  }

  try {
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return signature === computedSignature;
  } catch (error) {
    console.error('❌ Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Handler function for Airtable webhooks
 */
async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify webhook signature if provided
    const signature = req.headers['x-airtable-signature'];
    if (signature) {
      const isValid = verifyWebhookSignature(req.body, signature);
      if (!isValid) {
        console.error('❌ Webhook signature verification failed');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Parse webhook payload
    // Note: Airtable webhook format may vary - adjust based on actual payload structure
    const { base, table, timestamp } = req.body;

    console.log('📬 Webhook received:', {
      base: base?.id,
      table: table?.name,
      timestamp
    });

    // Determine which entity to sync based on table name
    const tableName = table?.name?.toLowerCase();
    const entityType = ENTITY_MAP[tableName];
    const scriptPath = SCRIPT_MAP[tableName];

    if (!entityType || !scriptPath) {
      console.warn('⚠️  Unknown table:', tableName);
      return res.status(400).json({
        error: 'Unknown table',
        table: tableName,
        supported_tables: Object.keys(ENTITY_MAP)
      });
    }

    console.log(`🔄 Triggering ${entityType} sync...`);

    // Trigger sync asynchronously (don't wait for completion to avoid webhook timeout)
    const child = spawn('node', [scriptPath], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
      cwd: process.cwd()
    });

    child.unref(); // Allow process to continue in background

    // Respond immediately to prevent webhook timeout
    return res.status(202).json({
      success: true,
      message: 'Sync triggered',
      entity_type: entityType,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = handler;
