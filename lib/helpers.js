/**
 * Helper Utilities for Multi-Survey Architecture
 *
 * This module provides utility functions for working with dynamic collection names
 * and survey-specific data in the validation portal.
 */

const { getDb } = require('./db');
const { ObjectId } = require('mongodb');

/**
 * Get the enumerator stats collection name for a specific survey
 *
 * @param {string} assetId - KoboToolbox asset ID
 * @returns {string} Collection name in format: enumerators_stats-{assetId}
 * @throws {Error} If assetId is not provided
 */
const getEnumeratorStatsCollection = (assetId) => {
  if (!assetId) {
    throw new Error('Asset ID is required for enumerator stats collection');
  }
  return `enumerators_stats-${assetId}`;
};

/**
 * Get the survey flags collection name for a specific survey
 *
 * @param {string} assetId - KoboToolbox asset ID
 * @returns {string} Collection name in format: surveys_flags-{assetId}
 * @throws {Error} If assetId is not provided
 */
const getSurveyFlagsCollection = (assetId) => {
  if (!assetId) {
    throw new Error('Asset ID is required for survey flags collection');
  }
  return `surveys_flags-${assetId}`;
};

/**
 * Get all active asset IDs from the surveys collection
 *
 * @returns {Promise<string[]>} Array of asset IDs
 */
const getAllAssetIds = async () => {
  try {
    const database = await getDb();
    if (!database) return [];

    const surveys = await database.collection('surveys').find({ active: true }).toArray();
    return surveys.map(s => s.asset_id);
  } catch (error) {
    console.error('Error fetching asset IDs:', error);
    return [];
  }
};

/**
 * Get accessible surveys for a user based on their permissions
 *
 * @param {Object} user - User object from authentication
 * @param {Object} db - MongoDB database instance
 * @returns {Promise<Array>} Array of survey objects the user can access
 */
async function getAccessibleSurveys(user, db) {
  if (!user || !db) {
    return [];
  }

  // Get the full user object with permissions
  const fullUser = await db.collection('users').findOne({ username: user.username });

  if (!fullUser) {
    return [];
  }

  // Admin with full access - get all active surveys
  if (fullUser.role === 'admin' && (!fullUser.permissions?.surveys || fullUser.permissions.surveys.length === 0)) {
    return await db.collection('surveys')
      .find({ active: true })
      .toArray();
  }

  // Regular user - only their assigned surveys
  return await db.collection('surveys')
    .find({
      asset_id: { $in: fullUser.permissions?.surveys || [] },
      active: true
    })
    .toArray();
}

/**
 * Check if user has enumerator restrictions
 *
 * @param {Object} user - User object from authentication
 * @param {Object} db - MongoDB database instance
 * @returns {Promise<{hasRestrictions: boolean, allowedEnumerators: string[]}>}
 */
async function getEnumeratorRestrictions(user, db) {
  if (!user || !db) {
    return { hasRestrictions: false, allowedEnumerators: [] };
  }

  const fullUser = await db.collection('users').findOne({ username: user.username });

  if (!fullUser) {
    return { hasRestrictions: false, allowedEnumerators: [] };
  }

  const allowedEnumerators = fullUser.permissions?.enumerators || [];
  return {
    hasRestrictions: allowedEnumerators.length > 0,
    allowedEnumerators
  };
}

/**
 * Validate and convert string to ObjectId
 * Prevents server crashes from invalid ObjectId formats
 *
 * @param {string} id - The ID string to validate and convert
 * @param {string} fieldName - Name of the field (for error messages)
 * @returns {ObjectId} Valid MongoDB ObjectId
 * @throws {Error} If ID is missing or invalid format
 */
function validateObjectId(id, fieldName = 'ID') {
  if (!id || typeof id !== 'string') {
    throw new Error(`${fieldName} is required`);
  }

  if (!ObjectId.isValid(id)) {
    throw new Error(`Invalid ${fieldName} format`);
  }

  return new ObjectId(id);
}

/**
 * Sanitize CSV data to prevent formula injection attacks
 * Neutralizes cells starting with dangerous characters (=, +, -, @, tab, carriage return)
 *
 * @param {string} csvData - Raw CSV data string
 * @returns {string} Sanitized CSV data
 */
function sanitizeCSV(csvData) {
  if (!csvData || typeof csvData !== 'string') {
    return csvData;
  }

  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
  const lines = csvData.split('\n');

  return lines.map(line => {
    // Parse CSV line handling quoted values
    const cells = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        insideQuotes = !insideQuotes;
        currentCell += char;
      } else if (char === ',' && !insideQuotes) {
        cells.push(currentCell);
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell); // Add last cell

    // Sanitize each cell
    const sanitizedCells = cells.map(cell => {
      const trimmed = cell.trim();

      // Check if cell starts with a dangerous character
      if (dangerousChars.some(char => trimmed.startsWith(char))) {
        // If already quoted, add single quote inside quotes
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          return '"' + "'" + trimmed.substring(1);
        }
        // Otherwise, prefix with single quote and quote the whole value
        return '"' + "'" + trimmed + '"';
      }

      return cell;
    });

    return sanitizedCells.join(',');
  }).join('\n');
}

module.exports = {
  getEnumeratorStatsCollection,
  getSurveyFlagsCollection,
  getAllAssetIds,
  getAccessibleSurveys,
  getEnumeratorRestrictions,
  validateObjectId,
  sanitizeCSV
};
