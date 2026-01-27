/**
 * Cron Job: Sync All Entities from Airtable
 * Runs daily at 2 AM UTC (configured in vercel.json)
 *
 * Security: Protected by Vercel cron secret
 * This endpoint is automatically triggered by Vercel's cron system
 *
 * @module api/admin/cron-sync-all
 */

const { spawn } = require('child_process');
const { setCorsHeaders } = require('../../lib/response');

/**
 * Handler function for cron-triggered sync
 */
async function handler(req, res) {
  setCorsHeaders(res, req);

  // Verify this is a cron request from Vercel
  // Vercel automatically adds the Authorization header with the cron secret
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('❌ Cron sync unauthorized: Missing or invalid authorization header');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Missing authorization'
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const cronSecret = process.env.CRON_SECRET;

  // Note: Vercel provides CRON_SECRET automatically, no need to set manually
  if (cronSecret && token !== cronSecret) {
    console.error('❌ Cron sync unauthorized: Invalid token');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Invalid token'
    });
  }

  console.log('✅ Cron sync authorized, starting sync...');

  // Spawn master sync script
  const child = spawn('node', ['scripts/sync_all_from_airtable.js'], {
    env: process.env,
    cwd: process.cwd()
  });

  let output = '';
  let errorOutput = '';

  child.stdout.on('data', (data) => {
    output += data.toString();
    console.log(data.toString());
  });

  child.stderr.on('data', (data) => {
    errorOutput += data.toString();
    console.error(data.toString());
  });

  child.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Cron sync failed with exit code:', code);
      return res.status(500).json({
        success: false,
        error: 'Sync failed',
        exit_code: code,
        output: output.substring(0, 1000), // Limit output size
        error_output: errorOutput.substring(0, 1000)
      });
    }

    console.log('✅ Cron sync completed successfully');
    return res.status(200).json({
      success: true,
      message: 'Sync completed successfully',
      exit_code: code,
      output: output.substring(0, 1000) // Limit output size for response
    });
  });

  child.on('error', (error) => {
    console.error('❌ Cron sync error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  });
}

module.exports = handler;
