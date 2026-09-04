/**
 * GET /api/surveys/:asset_id/alert-codes
 *
 * Survey-specific alert code definitions, for the alert guide and the validation table.
 *
 * Resolved through the permission filter rather than by a direct `surveys` lookup: this
 * endpoint used to authenticate without authorizing, so any signed-in user could read the
 * alert-code configuration of any survey by guessing its asset_id, including surveys in
 * countries they have no access to.
 */

const { HttpError } = require('../../../lib/response');
const { withMiddleware } = require('../../../lib/middleware');
const { getAccessibleSurveys } = require('../../../lib/filter-permissions');

/**
 * Fallback definitions, used when a survey carries no `alert_codes` of its own.
 * Alert codes are per-survey configuration, so these are only a sensible default —
 * a survey that means something different by "3" must say so in the `surveys` collection.
 */
const DEFAULT_ALERT_CODES = {
  '1': 'A catch was reported, but no taxon was specified',
  '2': 'A taxon was specified, but no information was provided about the number of fish, their size, or their weight',
  '3': 'Length is smaller than minimum length threshold for the selected catch taxon',
  '4': 'Length exceeds maximum length threshold for the selected catch taxon',
  '5': 'Bucket weight exceeds maximum (50kg)',
  '6': 'Number of buckets exceeds maximum (300)',
  '7': 'Number of individuals exceeds maximum (100)',
  '8': 'Price per kg exceeds threshold',
  '9': 'Catch per unit effort exceeds maximum (30kg per hour per fisher)',
  '10': 'Revenue per unit effort exceeds threshold'
};

async function handler(req) {
  // Vercel converts [asset_id] to query.asset_id
  const asset_id = req.query.asset_id;

  if (!asset_id) {
    throw new HttpError('asset_id parameter is required', 400);
  }

  const accessibleSurveys = await getAccessibleSurveys(req.db, req.user);
  const survey = accessibleSurveys.find(s => s.asset_id === asset_id);

  // Same response whether the survey does not exist or the caller may not see it, so this
  // endpoint cannot be used to enumerate which asset_ids are real.
  if (!survey) {
    throw new HttpError('Survey not found or access denied', 404);
  }

  return {
    asset_id,
    alert_codes: survey.alert_codes || DEFAULT_ALERT_CODES
  };
}

module.exports = withMiddleware(handler, { methods: ['GET'] });
