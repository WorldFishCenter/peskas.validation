// Run with: node lib/submissions-query.test.js
const assert = require('node:assert/strict');
const { buildSubmissionsQuery } = require('./submissions-query');

// --- the sort allowlist: a query string must never reach .sort() unchecked ---
assert.deepEqual(buildSubmissionsQuery({ sort: 'submitted_by', order: 'asc' }).sort, { submitted_by: 1 });
assert.deepEqual(buildSubmissionsQuery({ sort: 'submitted_by' }).sort, { submitted_by: -1 });
for (const evil of ['$where', 'kobo_config.token', '__proto__', '', null, undefined, 42, { $ne: 1 }]) {
  assert.deepEqual(
    buildSubmissionsQuery({ sort: evil }).sort,
    { submission_date: -1 },
    `unlisted sort key should fall back: ${JSON.stringify(evil)}`
  );
}

// --- search is escaped, anchored, and matches both id representations ---
// `submission_id` is a string in three collections and an int in four.
const numeric = buildSubmissionsQuery({ search: '616868' });
assert.deepEqual(numeric.filter.$or, [
  { submitted_by: /^616868/i },
  { submission_id: /^616868/i },
  { submission_id: 616868 }
]);
const named = buildSubmissionsQuery({ search: '  jea  ' });
assert.deepEqual(named.filter.$or, [{ submitted_by: /^jea/i }, { submission_id: /^jea/i }]);
// Regex metacharacters are neutralised rather than compiled — `.*` must not match everything.
const escaped = buildSubmissionsQuery({ search: '.*' }).filter.$or[0].submitted_by;
assert.equal(escaped.source, '^\\.\\*');
assert.ok(!escaped.test('anything'));
assert.ok(escaped.test('.*literal'));
assert.equal(buildSubmissionsQuery({ search: '   ' }).filter.$or, undefined);

// --- date range: the picker sends YYYY-MM-DD, the column holds BSON dates ---
const dated = buildSubmissionsQuery({ from: '2025-01-02', to: '2025-01-03' });
assert.ok(dated.filter.submission_date.$gte instanceof Date);
assert.equal(dated.filter.submission_date.$gte.toISOString(), '2025-01-02T00:00:00.000Z');
assert.equal(dated.filter.submission_date.$lte.toISOString(), '2025-01-03T23:59:59.999Z');
assert.deepEqual(buildSubmissionsQuery({ from: '2025-01-02' }).filter.submission_date, {
  $gte: new Date('2025-01-02T00:00:00.000Z')
});
// Anything that is not a plain day is ignored, so no date filter is applied at all — the
// alternative is silently hiding every row of a survey whose submissions carry no date.
for (const bad of ['2025-13-99', 'yesterday', '2025-01-02T10:00:00Z', { $gt: '' }, '', null]) {
  assert.equal(
    buildSubmissionsQuery({ from: bad, to: bad }).filter.submission_date,
    undefined,
    `bad date should be ignored: ${JSON.stringify(bad)}`
  );
}

// --- alert presence mirrors the client-side rule it replaced (missing counts as "no alert") ---
assert.deepEqual(buildSubmissionsQuery({ alert: 'with-alerts' }).filter.alert_flag, { $nin: [null, ''] });
assert.deepEqual(buildSubmissionsQuery({ alert: 'no-alerts' }).filter.alert_flag, { $in: [null, ''] });
assert.equal(buildSubmissionsQuery({ alert: 'all' }).filter.alert_flag, undefined);
assert.equal(buildSubmissionsQuery({}).filter.alert_flag, undefined);

// --- paging is clamped, so no query string can ask for the whole collection again ---
assert.deepEqual(pick(buildSubmissionsQuery({ page: 3, limit: 25 })), { skip: 50, limit: 25, page: 3 });
assert.deepEqual(pick(buildSubmissionsQuery({})), { skip: 0, limit: 10, page: 1 });
assert.deepEqual(pick(buildSubmissionsQuery({ limit: '100000' })), { skip: 0, limit: 200, page: 1 });
assert.deepEqual(pick(buildSubmissionsQuery({ page: '0', limit: '0' })), { skip: 0, limit: 1, page: 1 });
assert.deepEqual(pick(buildSubmissionsQuery({ page: -5, limit: 'abc' })), { skip: 0, limit: 10, page: 1 });

// --- permission scoping is never dropped, whatever the client sends ---
const scoped = buildSubmissionsQuery(
  { status: 'validation_status_approved', search: 'x' },
  { submitted_by: { $in: ['nassormgrabd'] } }
);
assert.deepEqual(scoped.filter.submitted_by, { $in: ['nassormgrabd'] });
assert.deepEqual(scoped.filter.type, { $ne: 'metadata' });
assert.equal(scoped.filter.validation_status, 'validation_status_approved');

function pick({ skip, limit, page }) {
  return { skip, limit, page };
}

console.log('submissions-query: all assertions passed');
