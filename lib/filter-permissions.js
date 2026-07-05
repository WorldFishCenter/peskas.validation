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
 * Error raised when a download selection is empty, unauthorized, or too broad.
 * Carries an HTTP status so endpoints can return a clear client-facing message
 * (400/403) instead of a generic 500.
 */
class DownloadPermissionError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'DownloadPermissionError';
    this.statusCode = statusCode;
  }
}

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

  // Apply country filter if provided (case-insensitive match)
  if (countryId) {
    query.country_id = { $regex: new RegExp(`^${countryId}$`, 'i') };
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
 * @param {String} surveyId - Optional survey filter (asset_id)
 * @returns {Promise<Array>} Array of accessible district objects
 */
async function getAccessibleDistricts(user, countryId = null, surveyId = null) {
  const database = await getDb();

  let query = { active: true };

  // Apply country filter if provided (case-insensitive match)
  if (countryId) {
    query.country_id = { $regex: new RegExp(`^${countryId}$`, 'i') };
  }

  // Apply survey filter if provided (CASCADE: Survey → Districts)
  // District can belong to multiple surveys, so check if surveyId is in asset_ids array
  if (surveyId) {
    query.asset_ids = surveyId;
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
 * Maximum number of individual PeSKAS API calls a single download may fan out to.
 *
 * PeSKAS accepts one (country, survey_id, gaul_2) triple per request, so a user with
 * several forms is served by merging one call per form. This cap protects the serverless
 * time/memory budget; beyond it, the user is asked to narrow their selection instead of
 * the request being silently truncated.
 */
const MAX_DOWNLOAD_REQUESTS = 15;

/**
 * Normalize a survey's `country_id` into the lowercase country code PeSKAS expects.
 * `country_id` is synced verbatim from Airtable's "Associated Countries" and may be a
 * plain string or a single-element array, so both are handled.
 *
 * @param {string|Array<string>} countryId
 * @returns {string} Lowercase country code, or '' if it cannot be resolved
 */
function normalizeCountryCode(countryId) {
  const raw = Array.isArray(countryId) ? countryId[0] : countryId;
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/**
 * Resolve a user's download selection into concrete, permission-safe PeSKAS request
 * filter sets.
 *
 * Every returned request is pinned to a specific `survey_id` the user is authorized for
 * (the only exception being full-access admins who may request an entire country), and
 * the `country` is derived per-survey from the `surveys` collection rather than from
 * `user.country[0]`. This guarantees a download can never return data from a form the
 * user cannot access, and that survey selection actually scopes the data.
 *
 * The PeSKAS `survey_id` equals the KoboToolbox `asset_id`, so it can be sent directly.
 *
 * @param {Object} user - Authenticated user (req.user), incl. role, country, permissions
 * @param {Object} queryParams - Request query parameters (country, survey_id, gaul_2)
 * @returns {Promise<Array<{country: string, survey_id?: string, gaul_2?: string}>>}
 *          One filter set per PeSKAS call required to satisfy the (permission-limited) selection.
 * @throws {Error} If the selection is empty, unauthorized, or too broad to serve in one download
 */
async function resolveDownloadRequests(user, queryParams) {
  const { country, survey_id, gaul_2 } = queryParams;

  const requestedSurveyIds = survey_id
    ? survey_id.split(',').map(id => id.trim()).filter(Boolean)
    : [];
  const requestedGaul = gaul_2 && gaul_2.trim() ? gaul_2.trim() : null;

  // ---- Admin: explicit country, optional single survey/district, full access ----
  if (user.role === 'admin') {
    if (!country) {
      throw new DownloadPermissionError('Country parameter is required for admin users', 400);
    }

    const request = { country };

    if (requestedSurveyIds.length > 0) {
      // Validate the requested survey is accessible to this admin (empty perms = all)
      const accessibleSurveys = await getAccessibleSurveys(user, country);
      const allowed = new Set(accessibleSurveys.map(s => s.asset_id));
      const picked = requestedSurveyIds.find(id => allowed.has(id));
      if (!picked) {
        throw new DownloadPermissionError('The requested survey is not accessible.', 403);
      }
      request.survey_id = picked;
    }

    if (requestedGaul) {
      request.gaul_2 = requestedGaul;
    }

    return [request];
  }

  // ---- Regular user: strictly scoped to permitted forms (and districts) ----
  // All accessible surveys across every country the user is assigned to. Country is
  // taken from each survey, so multi-country users are handled correctly.
  const accessibleSurveys = await getAccessibleSurveys(user);
  if (accessibleSurveys.length === 0) {
    throw new DownloadPermissionError(
      'No surveys assigned to your user account. Please contact an administrator.', 403
    );
  }

  // Narrow to the explicitly requested survey(s), if any. Deny (never widen) on mismatch.
  let selectedSurveys = accessibleSurveys;
  if (requestedSurveyIds.length > 0) {
    selectedSurveys = accessibleSurveys.filter(s => requestedSurveyIds.includes(s.asset_id));
    if (selectedSurveys.length === 0) {
      throw new DownloadPermissionError('You do not have access to the requested survey.', 403);
    }
  }

  const allowedGaulCodes = user.permissions?.gaul_codes || [];

  // The district (gaul_2) is a user-chosen filter, not an auto-restriction:
  //   - no district selected            → whole form (all districts)
  //   - district selected               → filter by that district
  // A district-restricted user may only filter by a district within their permitted set
  // (the dropdown only offers those; this guards a crafted request).
  if (requestedGaul && allowedGaulCodes.length > 0 && !allowedGaulCodes.includes(requestedGaul)) {
    throw new DownloadPermissionError('You do not have access to the requested district.', 403);
  }

  const requests = [];

  for (const survey of selectedSurveys) {
    const surveyCountry = normalizeCountryCode(survey.country_id);
    if (!surveyCountry) {
      // A survey without a resolvable country cannot be queried against PeSKAS.
      throw new DownloadPermissionError(
        `Survey "${survey.name || survey.asset_id}" has no associated country configured. ` +
        `Please contact an administrator.`, 400
      );
    }

    const request = { country: surveyCountry, survey_id: survey.asset_id };
    if (requestedGaul) {
      // Filter by the selected district (validated above).
      request.gaul_2 = requestedGaul;
    }
    requests.push(request);
  }

  if (requests.length === 0) {
    throw new DownloadPermissionError(
      'No accessible data matches your permissions for the selected filters.', 400
    );
  }

  if (requests.length > MAX_DOWNLOAD_REQUESTS) {
    throw new DownloadPermissionError(
      `Your selection spans ${requests.length} forms, which is too many to download at once. ` +
      `Please select a specific survey to narrow your download.`, 400
    );
  }

  return requests;
}

module.exports = {
  getAccessibleSurveys,
  getAccessibleCountries,
  getAccessibleDistricts,
  resolveDownloadRequests,
  DownloadPermissionError,
  MAX_DOWNLOAD_REQUESTS
};
