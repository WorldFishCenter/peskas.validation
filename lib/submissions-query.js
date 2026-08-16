/**
 * Query construction for GET /api/kobo/submissions.
 *
 * The endpoint used to return the whole collection — 51,912 rows and 9.8 MB on Mozambique SSF-CD,
 * past Vercel's 4.5 MB response cap. A default date window cannot fix that (30 of those rows fall
 * in the last 90 days and the data goes back to 2013), so the table pages, sorts and filters on
 * the server instead.
 *
 * Kept out of the handler so the two security-relevant rules — the sort allowlist and regex
 * escaping — can be exercised without a database. See `lib/submissions-query.test.js`.
 */

const { escapeRegex, isValidDate } = require('./helpers');

/**
 * Sort keys a client may ask for. Anything else falls back to the default, so a query string
 * can never reach `.sort()` unchecked.
 */
const SORTABLE_FIELDS = [
  'submission_id',
  'submission_date',
  'submitted_by',
  'validation_status',
  'validated_at',
  'alert_flag'
];

const DEFAULT_SORT = 'submission_date';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 200;

/** `YYYY-MM-DD`, which is what `<input type="date">` sends. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isDay(value) {
  return typeof value === 'string' && DAY.test(value) && isValidDate(value);
}

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

/**
 * Translate the table's query string into a MongoDB filter, sort and page window.
 *
 * `submission_date` is stored as a BSON date in every populated collection, so the range bounds
 * are `Date` objects rather than the `YYYY-MM-DD` strings the picker sends. `submission_id` is a
 * string in three collections and an int in four, which is why a numeric search term is matched
 * both ways.
 *
 * @param {Record<string, any>} query - `req.query`
 * @param {Record<string, any>} baseFilter - permission scoping, e.g. the enumerator restriction
 * @returns {{filter: Record<string, any>, sort: Record<string, 1|-1>, skip: number, limit: number, page: number}}
 */
function buildSubmissionsQuery(query = {}, baseFilter = {}) {
  /** @type {Record<string, any>} */
  const filter = { type: { $ne: 'metadata' }, ...baseFilter };

  if (typeof query.status === 'string' && query.status) {
    filter.validation_status = query.status;
  }

  // Mirrors the client-side rule the table used before: an alert is a non-empty `alert_flag`.
  // `$nin`/`$in` with null also covers documents where the field is absent entirely.
  if (query.alert === 'with-alerts') {
    filter.alert_flag = { $nin: [null, ''] };
  } else if (query.alert === 'no-alerts') {
    filter.alert_flag = { $in: [null, ''] };
  }

  if (isDay(query.from) || isDay(query.to)) {
    filter.submission_date = {};
    if (isDay(query.from)) filter.submission_date.$gte = new Date(`${query.from}T00:00:00.000Z`);
    if (isDay(query.to)) filter.submission_date.$lte = new Date(`${query.to}T23:59:59.999Z`);
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    // Escaped because the term arrives from a query string. Anchored and case-insensitive, which
    // is a scan either way — `$options: 'i'` rules out an index whatever the anchor — but it is a
    // bounded one: the worst case (a term matching nothing on the 51,912-row survey) measured
    // 0.69 s end to end. The client debounces, so this does not fire per keystroke.
    const prefix = new RegExp(`^${escapeRegex(search)}`, 'i');
    filter.$or = [{ submitted_by: prefix }, { submission_id: prefix }];
    // A regex never matches a numeric `submission_id`, so match it exactly as well.
    if (/^\d+$/.test(search)) filter.$or.push({ submission_id: Number(search) });
  }

  /** @type {string} */
  const sortField = SORTABLE_FIELDS.includes(query.sort) ? query.sort : DEFAULT_SORT;
  /** @type {1 | -1} */
  const direction = query.order === 'asc' ? 1 : -1;
  const sort = { [sortField]: direction };

  const limit = Math.min(Math.max(toInt(query.limit, DEFAULT_LIMIT), 1), MAX_LIMIT);
  const page = Math.max(toInt(query.page, 1), 1);

  return { filter, sort, skip: (page - 1) * limit, limit, page };
}

module.exports = { buildSubmissionsQuery };
