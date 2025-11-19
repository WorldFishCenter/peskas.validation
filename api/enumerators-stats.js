/**
 * GET /api/enumerators-stats
 *
 * Fetch enumerator statistics from MongoDB
 * Multi-survey aware with enumerator filtering
 * Requires authentication
 */

const { withMiddleware, authenticateUser } = require('../lib/middleware');
const { getDb } = require('../lib/db');
const { getEnumeratorStatsCollection } = require('../lib/helpers');
const { sendServerError, setCorsHeaders } = require('../lib/response');

async function handler(req, res) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const database = await getDb();
    if (!database) {
      return sendServerError(res, 'Database not configured');
    }

    // Get the authenticated user's full data
    const user = await database.collection('users').findOne({ username: req.user.username });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Determine which surveys the user has access to
    let accessibleAssetIds;

    if (user.role === 'admin') {
      // Admin users get full access to ALL active surveys, regardless of permissions.surveys
      const surveys = await database.collection('surveys')
        .find({ active: true })
        .toArray();
      accessibleAssetIds = surveys.map(s => s.asset_id);
    } else {
      // Regular user - only their assigned surveys
      accessibleAssetIds = user.permissions?.surveys || [];
    }

    if (accessibleAssetIds.length === 0) {
      return res.json([]);
    }

    // Determine if user has enumerator restrictions
    const allowedEnumerators = user.permissions?.enumerators || [];
    const hasEnumeratorRestrictions = allowedEnumerators.length > 0;

    // Fetch stats from each accessible survey's stats collection
    const statsPromises = accessibleAssetIds.map(async (assetId) => {
      const collectionName = getEnumeratorStatsCollection(assetId);

      try {
        const stats = await database.collection(collectionName)
          .find({})
          .toArray();

        // Apply enumerator filtering if user has restrictions
        return stats.filter(stat => {
          if (hasEnumeratorRestrictions) {
            return allowedEnumerators.includes(stat.submitted_by);
          }
          return true;
        });
      } catch (error) {
        return [];
      }
    });

    const allStats = await Promise.all(statsPromises);
    const flattenedStats = allStats.flat();

    return res.json(flattenedStats);
  } catch (error) {
    console.error('Error fetching enumerator statistics:', error);
    return sendServerError(res, 'Failed to fetch enumerator statistics');
  }
}

module.exports = withMiddleware(handler, authenticateUser);
