/**
 * POST /api/admin/sync-users
 *
 * Sync users from Airtable (Admin only)
 * Requires authentication + admin role
 *
 * Can be used:
 * 1. Via API endpoint (this file) - works locally and in Vercel
 * 2. Via CLI: node scripts/sync_users_from_airtable.cjs
 */

const { withMiddleware } = require('../../lib/middleware');
const { syncUsersFromAirtable } = require('../../lib/airtable-sync-users');

async function handler(req, res) {
  try {
    const result = await syncUsersFromAirtable();

    return res.json({
      success: true,
      message: 'Users synced successfully from Airtable',
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
      skipped: result.skipped,
      total: result.total,
      // Don't return passwords in API response for security
      passwordsGenerated: result.generatedPasswords ? result.generatedPasswords.length : 0
    });
  } catch (error) {
    console.error('Sync users error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync users from Airtable',
      message: error.message
    });
  }
}

module.exports = withMiddleware(handler, { methods: ['POST'], admin: true });
