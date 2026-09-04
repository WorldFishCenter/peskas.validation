/**
 * GET /api/enumerators-stats
 *
 * Fetch enumerator statistics from MongoDB filtered by user permissions.
 * Supports per-survey loading — requires explicit survey selection when user
 * has access to multiple surveys (same pattern as /api/kobo/submissions).
 * Requires authentication.
 */

const { withMiddleware } = require('../lib/middleware');
const { getEnumeratorStatsCollection, PLACEHOLDER_ENUMERATORS } = require('../lib/helpers');
const { enumeratorFilter } = require('../lib/filter-permissions');
const { resolveSurveySelection, SURVEY_REQUIRED, SURVEY_DENIED } = require('../lib/survey-selection');
const { sendSuccess, sendServerError } = require('../lib/response');

/** Kept local rather than shared with `api/kobo/submissions.js` — the survey shape already
 *  varies by endpoint (`api/data-download/metadata.js` carries `active` instead, and
 *  `submissions` adds `alert_codes`). Only the *selection* is shared; see lib/survey-selection.js. */
const surveyRef = s => ({ asset_id: s.asset_id, name: s.name, country_id: s.country_id });

const emptyStats = (res, surveys = [], code = undefined) =>
  sendSuccess(res, {
    count: 0,
    results: [],
    ...(code && { code }),
    metadata: { accessible_surveys: surveys.map(surveyRef) }
  });

async function handler(req, res) {
  try {
    const database = req.db;
    const user = req.user;

    // Permission filtering and survey selection both go through shared modules. This endpoint
    // used to inline its own copy of each, which is how the two came to drift apart.
    const selection = await resolveSurveySelection(req.db, user, req.query.survey_id);

    if (selection.kind === 'none') return emptyStats(res);
    if (selection.kind === 'denied') return emptyStats(res, selection.surveys, SURVEY_DENIED);
    if (selection.kind === 'ambiguous') return emptyStats(res, selection.surveys, SURVEY_REQUIRED);

    // Exactly one survey is loaded per request, same as /api/kobo/submissions.
    const { survey, surveys: allAccessibleSurveys } = selection;
    const enumerators = enumeratorFilter(user);

    // The dashboard never shows an individual submission: every chart is a count per enumerator,
    // per day, or per alert code. So the grouping happens in MongoDB rather than being shipped raw
    // and grouped in the browser — 52,102 documents collapse to 9,582 rollup rows for the largest
    // survey, measured. Every figure the UI renders is still derivable, because the rollup key is
    // the full (enumerator, day, alert code) triple.
    //
    // `$convert` rather than a bare `$dateToString`: not every collection is guaranteed to store
    // `submission_date` as a BSON date, and a string would abort the whole pipeline. A row whose
    // date will not parse still counts toward the enumerator's total, it just has no day.
    const results = await database.collection(getEnumeratorStatsCollection(survey.asset_id))
      .aggregate([
        {
          $match: {
            type: { $ne: 'metadata' },
            submitted_by: { $nin: PLACEHOLDER_ENUMERATORS },
            ...enumerators
          }
        },
        {
          $group: {
            _id: {
              submitted_by: '$submitted_by',
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: { $convert: { input: '$submission_date', to: 'date', onError: null, onNull: null } },
                  onNull: null
                }
              },
              alert_flag: '$alert_flag'
            },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            count: 1,
            submitted_by: '$_id.submitted_by',
            date: '$_id.date',
            // Absent, 'NA' and '' all mean "no alert". Collapsing them to one absent field keeps
            // the client from having to know three spellings of the same thing.
            alert_flag: {
              $cond: [{ $in: ['$_id.alert_flag', [null, 'NA', '']] }, '$$REMOVE', '$_id.alert_flag']
            }
          }
        }
      ])
      .toArray();

    return sendSuccess(res, {
      count: results.length,
      results,
      metadata: {
        survey: surveyRef(survey),
        accessible_surveys: allAccessibleSurveys.map(surveyRef)
      }
    });

  } catch (error) {
    console.error('Error in enumerators-stats handler:', error);
    return sendServerError(res, 'Failed to fetch enumerator statistics');
  }
}

module.exports = withMiddleware(handler, { methods: ['GET'] });
