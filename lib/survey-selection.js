/**
 * Which survey is this request about?
 *
 * `/api/kobo/submissions` and `/api/enumerators-stats` each serve exactly one survey per
 * request, and both had to answer the same four-way question first: does this user have any
 * surveys, did they ask for one, may they see the one they asked for, and can we pick for them?
 * That was ~45 lines duplicated between the two handlers, differing only in wording.
 *
 * The answer is returned as a tagged result rather than written to `res`, so each handler keeps
 * control of its own response shape — the survey projection genuinely differs between them
 * (`submissions` carries `alert_codes`, `enumerators-stats` does not).
 *
 * @module lib/survey-selection
 */

const { getAccessibleSurveys } = require('./filter-permissions');

/**
 * Machine-readable reasons a request resolved to no survey.
 *
 * These are the wire contract, and they exist because the reason used to travel as an English
 * sentence that the browser compared verbatim (`'Please select a survey to view submissions'`).
 * That made a user-facing string load-bearing: it could not be translated, and editing it
 * silently changed the frontend's control flow.
 */
const SURVEY_REQUIRED = 'SURVEY_REQUIRED';
const SURVEY_DENIED = 'SURVEY_DENIED';

/**
 * Resolve the survey a request should load.
 *
 * @param {import('mongodb').Db} database - Database handle (`req.db`)
 * @param {Object} user - Authenticated user (`req.user`)
 * @param {string} [requestedAssetId] - The client's `survey_id`, if it sent one
 * @returns {Promise<{kind: 'none'|'denied'|'ambiguous'|'resolved', surveys: Array, survey?: Object}>}
 *   `surveys` is always the user's full accessible list — the selector needs it regardless of
 *   which survey ends up loaded. `survey` is present only when `kind` is `'resolved'`.
 */
async function resolveSurveySelection(database, user, requestedAssetId) {
  const surveys = await getAccessibleSurveys(database, user);

  if (surveys.length === 0) {
    return { kind: 'none', surveys: [] };
  }

  if (requestedAssetId) {
    const survey = surveys.find(s => s.asset_id === requestedAssetId);
    // Denied and non-existent are the same answer on purpose: a distinguishable "no such
    // survey" would let any signed-in user probe which asset_ids exist.
    return survey ? { kind: 'resolved', surveys, survey } : { kind: 'denied', surveys };
  }

  // One survey needs no choosing. Several do — loading them all at once is what put the
  // response past Vercel's size cap in the first place.
  return surveys.length === 1
    ? { kind: 'resolved', surveys, survey: surveys[0] }
    : { kind: 'ambiguous', surveys };
}

module.exports = {
  resolveSurveySelection,
  SURVEY_REQUIRED,
  SURVEY_DENIED
};
