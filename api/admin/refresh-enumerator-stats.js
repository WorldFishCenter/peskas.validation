/**
 * POST /api/admin/refresh-enumerator-stats
 *
 * Refresh enumerator statistics (Admin only)
 * Requires authentication + admin role
 *
 * This endpoint provides a way to trigger statistics refresh from the portal.
 * The actual statistics computation should be done by the R pipeline or a
 * dedicated background job.
 */

const { withMiddleware, authenticateUser, requireAdmin } = require('../../lib/middleware');
const { setCorsHeaders } = require('../../lib/response');

async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Return 501 with informative message
    // The R pipeline handles statistics computation
    return res.status(501).json({
      success: false,
      error: 'This feature requires the R pipeline to refresh statistics',
      message: 'Enumerator statistics are automatically updated by the data pipeline. Manual refresh from the portal is not currently available.',
      documentation: 'Run the R pipeline script to refresh statistics',
      alternatives: [
        'Run the R pipeline: Rscript your_pipeline_script.R',
        'Statistics are automatically refreshed when the pipeline runs',
        'Contact your administrator to schedule a pipeline run'
      ]
    });
  } catch (error) {
    console.error('Refresh enumerator stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh enumerator statistics',
      message: error.message
    });
  }
}

module.exports = withMiddleware(handler, authenticateUser, requireAdmin);
