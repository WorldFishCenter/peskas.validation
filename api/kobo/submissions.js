/**
 * GET /api/kobo/submissions
 *
 * Fetch one page of submissions from MongoDB, filtered by user permissions.
 * Supports multi-survey architecture with explicit survey selection.
 * Requires authentication.
 *
 * Paging, sorting and filtering all happen in MongoDB. Returning the whole collection put the
 * largest survey (51,912 rows) at 9.8 MB — past Vercel's 4.5 MB response cap, and growing with
 * the data. Query parameters: `page`, `limit`, `sort`, `order`, `status`, `alert`, `from`, `to`,
 * `search`; see `lib/submissions-query.js` for how each is validated.
 */

const { withMiddleware } = require('../../lib/middleware');
const { getSurveyFlagsCollection } = require('../../lib/helpers');
const { enumeratorFilter } = require('../../lib/filter-permissions');
const { resolveSurveySelection, SURVEY_REQUIRED, SURVEY_DENIED } = require('../../lib/survey-selection');
const { buildSubmissionsQuery } = require('../../lib/submissions-query');
const { sendSuccess, sendServerError } = require('../../lib/response');

const PROJECTION = {
  submission_id: 1,
  submission_date: 1,
  submitted_by: 1,
  validation_status: 1,
  validated_at: 1,
  validated_by: 1,
  alert_flag: 1,
  _id: 0
};

const surveyRef = s => ({ asset_id: s.asset_id, name: s.name, country_id: s.country_id });

const surveyOption = s => ({ ...surveyRef(s), alert_codes: s.alert_codes || {} });

const emptyPage = (res, surveys = [], code = undefined) =>
  sendSuccess(res, {
    count: 0, total: 0, page: 1, limit: 0, results: [],
    ...(code && { code }),
    metadata: { accessible_surveys: surveys.map(surveyOption) }
  });

async function handler(req, res) {
  try {
    const database = req.db;
    const user = req.user;

    const selection = await resolveSurveySelection(database, user, req.query.survey_id);

    if (selection.kind === 'none') return emptyPage(res);
    if (selection.kind === 'denied') return emptyPage(res, selection.surveys, SURVEY_DENIED);
    if (selection.kind === 'ambiguous') return emptyPage(res, selection.surveys, SURVEY_REQUIRED);

    // Exactly one survey is loaded per request — either the client picked one, or the user has
    // only one. `resolveSurveySelection` guarantees it, so there is no fan-out to merge.
    const { survey, surveys: allAccessibleSurveys } = selection;
    const collection = database.collection(getSurveyFlagsCollection(survey.asset_id));

    const enumerators = enumeratorFilter(user);
    const { filter, sort, skip, limit, page } = buildSubmissionsQuery(req.query, enumerators);

    // Everything the survey as a whole implies — which statuses exist, how far the dates run —
    // has to come from the collection now that only one page of rows is loaded. The picker bounds
    // used to be derived from the rows themselves, which stops being correct at the first page
    // break.
    //
    // Only computed when the client asks (`?meta=1`), because none of it changes as you page,
    // sort or filter within a survey — `src/api/api.ts` keeps it and re-asks when the survey
    // changes. One request at a time these three cost nothing measurable; ten at once they cost
    // a third of the response time, which is where the page turns of several users collide.
    const wantMeta = req.query.meta === '1';
    const scope = { type: { $ne: 'metadata' }, ...enumerators };
    const dated = { ...scope, submission_date: { $ne: null } };
    /** @type {import('mongodb').FindOptions} */
    const bounds = { sort: { submission_date: 1 }, projection: { submission_date: 1, _id: 0 } };

    const [results, total, statuses, earliest, latest] = await Promise.all([
      collection.find(filter, { projection: PROJECTION }).sort(sort).skip(skip).limit(limit).toArray(),
      collection.countDocuments(filter),
      wantMeta ? collection.distinct('validation_status', scope) : null,
      wantMeta ? collection.findOne(dated, bounds) : null,
      wantMeta ? collection.findOne(dated, { ...bounds, sort: { submission_date: -1 } }) : null
    ]);

    // Rows are returned exactly as stored. The identity of the owning survey goes in
    // `metadata.survey` once instead of on every row, and absent fields stay absent rather than
    // being padded with '' / null. Repeating three survey fields and six empty defaults across
    // 52k rows doubled the largest response (18.5 MB measured) for no added information;
    // `src/api/api.ts` re-attaches them client-side.
    return sendSuccess(res, {
      count: results.length,
      total,
      page,
      limit,
      results,
      metadata: {
        survey: surveyRef(survey),
        // Absent rather than empty when not asked for, so the client can tell "no statuses in
        // this survey" from "you did not ask" and keeps what it already has.
        ...(wantMeta && {
          statuses: statuses.filter(Boolean).sort(),
          date_range: {
            min: earliest?.submission_date ?? null,
            max: latest?.submission_date ?? null
          }
        }),
        accessible_surveys: allAccessibleSurveys.map(surveyOption)
      }
    });

  } catch (error) {
    console.error('Error in submissions handler:', error);
    return sendServerError(res, 'Failed to fetch submissions');
  }
}

module.exports = withMiddleware(handler, { methods: ['GET'] });
