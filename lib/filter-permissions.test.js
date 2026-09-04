// Run with: node lib/filter-permissions.test.js
//
// These assertions exist because `filter-permissions` is the gate in front of every survey,
// country and download in the portal, and until `database` became a parameter there was no way
// to reach any of it from a test: each function opened its own connection.
//
// The fake below is the second adapter that makes the seam real — the Mongo handle is the first.
// It implements only what the module actually calls: collection().find().sort().toArray().

const assert = require('node:assert/strict');
const {
  getAccessibleSurveys,
  getAccessibleCountries,
  resolveDownloadRequests,
  hasFullSurveyAccess,
  DownloadPermissionError,
  MAX_DOWNLOAD_REQUESTS
} = require('./filter-permissions');

/**
 * Minimal in-memory stand-in for the Db handle the module is handed.
 *
 * Typed loosely on purpose: it implements the four methods the module actually calls, not the
 * ~26 members of mongodb's `Db`. Making it structurally complete would be a page of stubs that
 * no assertion here would ever exercise.
 *
 * @param {Object} collections - Documents per collection name
 * @returns {any} Something `filter-permissions` cannot tell from a real Db
 */
function fakeDb(collections) {
  const matches = (doc, query) =>
    Object.entries(query).every(([field, cond]) =>
      cond && typeof cond === 'object' && '$in' in cond
        ? cond.$in.includes(doc[field])
        : doc[field] === cond);

  return {
    lastQuery: null,
    collection(name) {
      const docs = collections[name] || [];
      return {
        find: (query = {}) => {
          fake.lastQuery = { collection: name, query };
          const hits = docs.filter(d => matches(d, query));
          return { sort: () => ({ toArray: async () => hits }) };
        }
      };
    }
  };
}
let fake;

const SURVEYS = [
  { asset_id: 'aaaaaaaaaaaaaaaaaaaaaa', name: 'Zanzibar A', country_id: 'Zanzibar', active: true },
  { asset_id: 'bbbbbbbbbbbbbbbbbbbbbb', name: 'Kenya B', country_id: 'Kenya', active: true },
  { asset_id: 'cccccccccccccccccccccc', name: 'Kenya C', country_id: ['Kenya'], active: true },
  { asset_id: 'dddddddddddddddddddddd', name: 'Retired', country_id: 'Kenya', active: false }
];
const COUNTRIES = [
  { code: 'Kenya', name: 'Kenya', active: true },
  { code: 'Zanzibar', name: 'Zanzibar', active: true },
  { code: 'Mozambique', name: 'Mozambique', active: true }
];
const db = () => (fake = fakeDb({ surveys: SURVEYS, countries: COUNTRIES }));

const admin = perms => ({ username: 'adm', role: 'admin', permissions: { surveys: perms } });
const user = perms => ({ username: 'usr', role: 'user', permissions: { surveys: perms } });

async function main() {
  // ---- the admin/empty-array rule, the thing that used to be written three ways ----
  assert.equal(hasFullSurveyAccess(admin([])), true, 'admin with empty array sees everything');
  assert.equal(hasFullSurveyAccess({ username: 'a', role: 'admin' }), true, 'absent permissions too');
  assert.equal(hasFullSurveyAccess({ username: 'a', role: 'admin', permissions: {} }), true);
  assert.equal(hasFullSurveyAccess(admin(['aaaaaaaaaaaaaaaaaaaaaa'])), false, 'listed admin is restricted');
  assert.equal(hasFullSurveyAccess(user([])), false, 'a regular user with an empty array sees nothing');

  // A regular user with an empty array must get NO surveys — the inverse of the admin rule, and
  // the failure mode that would hand every survey to every user.
  assert.deepEqual(await getAccessibleSurveys(db(), user([])), []);
  assert.deepEqual(fake.lastQuery.query.asset_id, { $in: [] }, 'empty allowlist is still a filter');

  // Full-access admin: no asset_id predicate at all, and inactive surveys stay excluded.
  {
    const surveys = await getAccessibleSurveys(db(), admin([]));
    assert.equal(surveys.length, 3, 'all three active surveys');
    assert.equal('asset_id' in fake.lastQuery.query, false, 'no survey filter for a full-access admin');
    assert.equal(surveys.some(s => s.name === 'Retired'), false, 'inactive surveys excluded');
  }

  // Restricted admin is filtered exactly like a regular user.
  assert.deepEqual(
    (await getAccessibleSurveys(db(), admin(['bbbbbbbbbbbbbbbbbbbbbb']))).map(s => s.name),
    ['Kenya B']);
  assert.deepEqual(
    (await getAccessibleSurveys(db(), user(['bbbbbbbbbbbbbbbbbbbbbb']))).map(s => s.name),
    ['Kenya B']);

  // Country filtering normalizes both sides: stored capitalized, sometimes wrapped in an array.
  assert.deepEqual(
    (await getAccessibleSurveys(db(), admin([]), 'kenya')).map(s => s.name),
    ['Kenya B', 'Kenya C'], 'lowercase query matches capitalized and array-wrapped country_id');
  assert.deepEqual(
    (await getAccessibleSurveys(db(), admin([]), 'Zanzibar')).map(s => s.name),
    ['Zanzibar A']);

  // Countries follow surveys for anyone who is not a full-access admin.
  assert.deepEqual((await getAccessibleCountries(db(), admin([]))).map(c => c.code),
    ['Kenya', 'Zanzibar', 'Mozambique'], 'full-access admin gets every active country');
  assert.deepEqual((await getAccessibleCountries(db(), user(['aaaaaaaaaaaaaaaaaaaaaa']))).map(c => c.code),
    ['Zanzibar'], 'a user reaches countries only through their surveys');

  // ---- resolveDownloadRequests: the nine throw paths, none of them previously reachable ----
  const rejects = async (fn, status, hint) => {
    await assert.rejects(fn, e => {
      assert.ok(e instanceof DownloadPermissionError, `${hint}: wrong error type`);
      assert.equal(e.statusCode, status, `${hint}: wrong status`);
      return true;
    }, hint);
  };

  await rejects(() => resolveDownloadRequests(db(), admin([]), {}), 400, 'admin without country');
  await rejects(() => resolveDownloadRequests(db(), admin([]), { country: '   ' }), 400, 'unresolvable country');
  await rejects(() => resolveDownloadRequests(db(), admin([]), { country: 'kenya', survey_id: 'nope' }), 403,
    'admin asking for a survey that is not theirs');
  await rejects(() => resolveDownloadRequests(db(), user([]), {}), 403, 'user with no surveys');
  await rejects(() => resolveDownloadRequests(db(), user(['bbbbbbbbbbbbbbbbbbbbbb']), { survey_id: 'aaaaaaaaaaaaaaaaaaaaaa' }),
    403, 'user asking for someone else\'s survey');

  // A district filter may only name a district the user is permitted.
  await rejects(() => resolveDownloadRequests(db(),
    { username: 'u', role: 'user', permissions: { surveys: ['bbbbbbbbbbbbbbbbbbbbbb'], gaul_codes: ['1'] } },
    { gaul_2: '2' }), 403, 'district outside the permitted set');

  // A survey with no resolvable country cannot be queried against PeSKAS.
  {
    const broken = fakeDb({ surveys: [{ asset_id: 'eeeeeeeeeeeeeeeeeeeeee', name: 'Nowhere', country_id: '', active: true }] });
    await rejects(() => resolveDownloadRequests(broken, user(["eeeeeeeeeeeeeeeeeeeeee"]), {}), 400, 'survey without a country');
  }

  // Fan-out is capped rather than silently truncated.
  {
    const many = Array.from({ length: MAX_DOWNLOAD_REQUESTS + 1 }, (_, i) => ({
      asset_id: `s${i}`.padEnd(22, '0'), name: `S${i}`, country_id: 'Kenya', active: true }));
    const ids = many.map(s => s.asset_id);
    await rejects(() => resolveDownloadRequests(fakeDb({ surveys: many }), user(ids), {}), 400, 'too many forms');
  }

  // ---- the happy paths ----
  {
    // Every request a regular user gets is pinned to one of their own forms, with the country
    // taken from the form rather than from client input. This is the 2026-07-05 decision.
    const requests = await resolveDownloadRequests(db(), user(['aaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbb']), {});
    assert.deepEqual(requests, [
      { country: 'zanzibar', survey_id: 'aaaaaaaaaaaaaaaaaaaaaa' },
      { country: 'kenya', survey_id: 'bbbbbbbbbbbbbbbbbbbbbb' }
    ], 'one request per permitted form, country derived per form');

    // A client-supplied country cannot widen or redirect the selection.
    const pinned = await resolveDownloadRequests(db(), user(['aaaaaaaaaaaaaaaaaaaaaa']), { country: 'kenya' });
    assert.deepEqual(pinned, [{ country: 'zanzibar', survey_id: 'aaaaaaaaaaaaaaaaaaaaaa' }],
      'country comes from the form, never from the query string');

    // Admin naming no form: one country-wide request. This is the documented exception —
    // a full-access admin may pull a whole country in a single PeSKAS call.
    assert.deepEqual(await resolveDownloadRequests(db(), admin([]), { country: 'Kenya' }),
      [{ country: 'kenya' }], 'admin country request is normalized to the slug');

    // An admin naming several forms gets one request each — the same meaning the query string
    // has for a regular user. This used to `.find()` the first accessible id and return a single
    // request, silently dropping every other form the admin had asked for.
    assert.deepEqual(
      await resolveDownloadRequests(db(), admin([]), {
        country: 'kenya',
        survey_id: 'bbbbbbbbbbbbbbbbbbbbbb,cccccccccccccccccccccc'
      }),
      [
        { country: 'kenya', survey_id: 'bbbbbbbbbbbbbbbbbbbbbb' },
        { country: 'kenya', survey_id: 'cccccccccccccccccccccc' }
      ],
      'admin selecting two forms downloads both');

    // Narrow to the intersection rather than rejecting the whole request over one id that is
    // out of scope — deny, never widen, exactly as the regular-user path does. Here the Zanzibar
    // form is not in the requested country, so only the Kenya one survives.
    assert.deepEqual(
      await resolveDownloadRequests(db(), admin([]), {
        country: 'kenya',
        survey_id: 'bbbbbbbbbbbbbbbbbbbbbb,aaaaaaaaaaaaaaaaaaaaaa'
      }),
      [{ country: 'kenya', survey_id: 'bbbbbbbbbbbbbbbbbbbbbb' }],
      'out-of-scope ids are dropped, not fatal');

    // A district filter rides along on every request in the fan-out.
    assert.deepEqual(
      await resolveDownloadRequests(db(), admin([]), {
        country: 'kenya',
        survey_id: 'bbbbbbbbbbbbbbbbbbbbbb,cccccccccccccccccccccc',
        gaul_2: '42'
      }),
      [
        { country: 'kenya', survey_id: 'bbbbbbbbbbbbbbbbbbbbbb', gaul_2: '42' },
        { country: 'kenya', survey_id: 'cccccccccccccccccccccc', gaul_2: '42' }
      ],
      'the district applies to each form, not just the first');

    // The admin fan-out is capped the same way the regular-user one is.
    {
      const many = Array.from({ length: MAX_DOWNLOAD_REQUESTS + 1 }, (_, i) => ({
        asset_id: `k${i}`.padEnd(22, '0'), name: `K${i}`, country_id: 'Kenya', active: true }));
      await rejects(() => resolveDownloadRequests(
        fakeDb({ surveys: many, countries: COUNTRIES }),
        admin([]),
        { country: 'kenya', survey_id: many.map(s => s.asset_id).join(',') }
      ), 400, 'admin selection spanning too many forms');
    }
  }

  console.log('filter-permissions: all assertions passed');
}

main().catch(err => { console.error(err); process.exit(1); });
