// Run with: node lib/survey-selection.test.js
//
// The four-way selection these assertions cover used to live twice, inline in two handlers that
// could only be exercised by making an HTTP request with a real database behind it.

const assert = require('node:assert/strict');
const { resolveSurveySelection, SURVEY_REQUIRED, SURVEY_DENIED } = require('./survey-selection');

const A = 'aaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbb';

/** @returns {any} Stands in for the Db handle; only `surveys.find().sort().toArray()` is used. */
const fakeDb = surveys => ({
  collection: () => ({
    find: (query = {}) => ({
      sort: () => ({
        toArray: async () => surveys.filter(s =>
          s.active && (!query.asset_id || query.asset_id.$in.includes(s.asset_id)))
      })
    })
  })
});

const SURVEYS = [
  { asset_id: A, name: 'Zanzibar A', country_id: 'Zanzibar', active: true },
  { asset_id: B, name: 'Kenya B', country_id: 'Kenya', active: true }
];

const admin = { username: 'adm', role: 'admin', permissions: { surveys: [] } };
const user = surveys => ({ username: 'usr', role: 'user', permissions: { surveys } });

async function main() {
  // No surveys at all.
  assert.deepEqual(await resolveSurveySelection(fakeDb(SURVEYS), user([])),
    { kind: 'none', surveys: [] });

  // One survey needs no choosing — this is what keeps single-survey users off the selector.
  {
    const r = await resolveSurveySelection(fakeDb(SURVEYS), user([A]));
    assert.equal(r.kind, 'resolved');
    assert.equal(r.survey.asset_id, A);
    assert.equal(r.surveys.length, 1);
  }

  // Several surveys and no choice: the caller must ask.
  {
    const r = await resolveSurveySelection(fakeDb(SURVEYS), admin);
    assert.equal(r.kind, 'ambiguous');
    assert.equal(r.surveys.length, 2, 'the full list still comes back, for the selector');
    assert.equal(r.survey, undefined);
  }

  // An explicit, permitted choice resolves regardless of how many others exist.
  {
    const r = await resolveSurveySelection(fakeDb(SURVEYS), admin, B);
    assert.equal(r.kind, 'resolved');
    assert.equal(r.survey.name, 'Kenya B');
    assert.equal(r.surveys.length, 2, 'the selector list is not narrowed to the choice');
  }

  // Asking for someone else's survey and asking for one that does not exist are the same answer,
  // so the endpoint cannot be used to discover which asset_ids are real.
  for (const requested of [A, 'zzzzzzzzzzzzzzzzzzzzzz']) {
    const r = await resolveSurveySelection(fakeDb(SURVEYS), user([B]), requested);
    assert.equal(r.kind, 'denied', `requesting ${requested}`);
    assert.equal(r.survey, undefined);
  }

  // The codes are the wire contract that replaced two English sentences.
  assert.equal(SURVEY_REQUIRED, 'SURVEY_REQUIRED');
  assert.equal(SURVEY_DENIED, 'SURVEY_DENIED');

  console.log('survey-selection: all assertions passed');
}

main().catch(err => { console.error(err); process.exit(1); });
