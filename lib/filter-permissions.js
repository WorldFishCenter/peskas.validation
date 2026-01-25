/**
 * Permission Filtering Utilities
 *
 * Centralized logic for filtering entities (surveys, districts, countries)
 * based on user permissions. Used across multiple endpoints to ensure
 * consistent permission enforcement.
 *
 * @module lib/filter-permissions
 */

const { getDb } = require('./db');

/**
 * Get accessible surveys for a user based on permissions
 *
 * @param {Object} user - User object from MongoDB
 * @param {String} countryId - Optional country filter
 * @returns {Promise<Array>} Array of accessible survey objects
 */
async function getAccessibleSurveys(user, countryId = null) {
  const database = await getDb();

  let query = { active: true };

  // Apply country filter if provided
  if (countryId) {
    query.country_id = countryId;
  }

  // Apply permission filtering
  if (user.role === 'admin') {
    // Admin with empty permissions.surveys = full access
    if (!user.permissions?.surveys || user.permissions.surveys.length === 0) {
      // No additional filtering - get all active surveys
    } else {
      // Admin with specific survey assignments
      query.asset_id = { $in: user.permissions.surveys };
    }
  } else {
    // Regular users - only their assigned surveys
    query.asset_id = { $in: user.permissions?.surveys || [] };
  }

  const surveys = await database.collection('surveys')
    .find(query)
    .sort({ country_id: 1, name: 1 })
    .toArray();

  return surveys;
}

/**
 * Get accessible countries for a user based on survey permissions
 *
 * @param {Object} user - User object from MongoDB
 * @returns {Promise<Array>} Array of accessible country objects
 */
async function getAccessibleCountries(user) {
  const database = await getDb();

  if (user.role === 'admin' && (!user.permissions?.surveys || user.permissions.surveys.length === 0)) {
    // Admin with full access - all active countries
    const countries = await database.collection('countries')
      .find({ active: true })
      .sort({ name: 1 })
      .toArray();

    return countries;
  } else {
    // Regular user or admin with specific permissions - countries via surveys
    const accessibleSurveys = await getAccessibleSurveys(user);
    const countryCodes = [...new Set(accessibleSurveys.map(s => s.country_id))];

    const countries = await database.collection('countries')
      .find({
        code: { $in: countryCodes },
        active: true
      })
      .sort({ name: 1 })
      .toArray();

    return countries;
  }
}

/**
 * Get accessible districts for a user based on GAUL code permissions
 *
 * @param {Object} user - User object from MongoDB
 * @param {String} countryId - Optional country filter
 * @returns {Promise<Array>} Array of accessible district objects
 */
async function getAccessibleDistricts(user, countryId = null) {
  const database = await getDb();

  let query = { active: true };

  // Apply country filter if provided
  if (countryId) {
    query.country_id = countryId;
  }

  // Apply GAUL code permission filtering
  if (user.role === 'admin') {
    // Admin users - all districts (no GAUL code restrictions)
  } else {
    // Regular users - filter by their assigned GAUL codes
    const allowedGaulCodes = user.permissions?.gaul_codes || [];

    if (allowedGaulCodes.length > 0) {
      query.code = { $in: allowedGaulCodes };
    }
    // If no GAUL code restrictions (empty array), show all districts
  }

  const districts = await database.collection('districts')
    .find(query)
    .sort({ code: 1 })
    .toArray();

  return districts;
}

/**
 * Apply permission-based filtering to query parameters
 * Used in preview.js and export.js for consistent filtering
 *
 * @param {Object} user - User object from MongoDB
 * @param {Object} queryParams - Request query parameters
 * @returns {Promise<Object>} Object with effective filters (country, survey_ids, gaul_codes)
 * @throws {Error} If validation fails
 */
async function applyDownloadPermissions(user, queryParams) {
  const {
    country,
    survey_id,
    gaul_2
  } = queryParams;

  let effectiveCountry;
  let effectiveSurveyIds = [];
  let effectiveGaulCodes = [];

  // 1. Determine effective country
  // Keep original case for MongoDB queries (database has "Zanzibar" not "zanzibar")
  if (user.role === 'admin') {
    // Admin must specify country
    if (!country) {
      throw new Error('Country parameter is required for admin users');
    }
    effectiveCountry = country;
  } else {
    // Regular user - use first assigned country
    if (!user.country || user.country.length === 0) {
      throw new Error('No countries assigned to your user account. Please contact an administrator.');
    }
    effectiveCountry = user.country[0];
  }

  // 2. Apply survey permission filtering
  const accessibleSurveys = await getAccessibleSurveys(user, effectiveCountry);
  const allowedSurveyIds = accessibleSurveys.map(s => s.asset_id);

  if (survey_id) {
    // Filter requested survey IDs by user permissions
    const requestedSurveyIds = survey_id.split(',').map(id => id.trim()).filter(Boolean);
    effectiveSurveyIds = requestedSurveyIds.filter(id => allowedSurveyIds.includes(id));
  } else {
    // No specific surveys requested - use all allowed surveys
    effectiveSurveyIds = allowedSurveyIds;
  }

  // 3. Apply GAUL code filtering
  if (user.role === 'admin') {
    // Admin can use any GAUL codes (or none)
    if (gaul_2) {
      effectiveGaulCodes = gaul_2.split(',').map(code => code.trim()).filter(Boolean);
    }
  } else {
    // Regular user - filter by permissions
    const allowedGaulCodes = user.permissions?.gaul_codes || [];

    if (gaul_2) {
      const requestedGaulCodes = gaul_2.split(',').map(code => code.trim()).filter(Boolean);

      if (allowedGaulCodes.length > 0) {
        // Filter requested codes by allowed codes
        effectiveGaulCodes = requestedGaulCodes.filter(code => allowedGaulCodes.includes(code));
      } else {
        // No restrictions - use all requested codes
        effectiveGaulCodes = requestedGaulCodes;
      }
    } else if (allowedGaulCodes.length > 0) {
      // If user has GAUL restrictions but didn't specify codes, use their allowed codes
      effectiveGaulCodes = allowedGaulCodes;
    }
  }

  return {
    effectiveCountry,
    effectiveSurveyIds,
    effectiveGaulCodes
  };
}

module.exports = {
  getAccessibleSurveys,
  getAccessibleCountries,
  getAccessibleDistricts,
  applyDownloadPermissions
};
