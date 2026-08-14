/**
 * Ensure every collection has the indexes the portal's queries need.
 *
 * Usage: node scripts/ensure_survey_indexes.cjs [--dry-run]
 *
 * Why this script exists
 * ----------------------
 * `surveys_flags-{asset_id}` and `enumerators_stats-{asset_id}` are written by the external R
 * pipeline, and it does not index them consistently. Audited 2026-08-13: seven of eleven populated
 * collections had the full set below; the rest had only `_id_` — including
 * `surveys_flags-a7bZivgzH5Y6kxP2nhG98w` with 31,387 documents, where the portal's
 * `.sort({ submission_date: -1 })` was therefore a blocking in-memory sort.
 *
 * The index sets here mirror what the well-indexed collections already carry, so running this
 * cannot make one collection differ from its peers. `createIndex` is idempotent — re-running is
 * free, and this is safe to run against production.
 *
 * Creating an index never changes data. This script does not drop or modify anything.
 *
 * Supersedes `add_performance_indexes.cjs`, which did the same job for the per-survey collections
 * under a second set of names (`type_1` where the pipeline writes `idx_type`) — two names for one
 * key, which MongoDB would have built as two indexes. The static-collection specs below are the
 * one thing that script did and this one did not; they are reproduced verbatim from what it
 * already built in production, so running this changes nothing that is already there.
 *
 * Not reproduced: its `surveys.country_code` index. That field is present on 5 of 14 survey
 * documents and no query in the portal filters on it.
 */

const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_VALIDATION_URI;
const MONGODB_DB = process.env.MONGODB_VALIDATION_DB;

if (!MONGODB_URI || !MONGODB_DB) {
  console.error('❌ ERROR: MONGODB_VALIDATION_URI and MONGODB_VALIDATION_DB must be set');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

/** Index specs, keyed by collection prefix. Names match what the R pipeline already creates. */
const INDEXES = {
  'surveys_flags-': [
    { key: { type: 1 }, name: 'idx_type' },
    { key: { submission_date: -1 }, name: 'idx_submission_date' },
    { key: { submitted_by: 1 }, name: 'idx_submitted_by' },
    { key: { validation_status: 1 }, name: 'idx_validation_status' },
    { key: { type: 1, submission_date: -1 }, name: 'idx_type_date' },
    { key: { submission_date: -1, submitted_by: 1 }, name: 'submission_date_-1_submitted_by_1' },
    { key: { validation_status: 1, submission_date: -1 }, name: 'validation_status_1_submission_date_-1' },
    { key: { submitted_by: 1, submission_date: -1 }, name: 'submitted_by_1_submission_date_-1' },
    { key: { alert_flag: 1, submission_date: -1 }, name: 'alert_flag_1_submission_date_-1' }
  ],
  'enumerators_stats-': [
    { key: { type: 1 }, name: 'idx_type' },
    { key: { submitted_by: 1 }, name: 'idx_submitted_by' },
    { key: { submission_date: -1 }, name: 'idx_submission_date' },
    { key: { submitted_by: 1, submission_date: -1 }, name: 'submitted_by_1_submission_date_-1' }
  ]
};

/** The fixed collections, keyed by exact name rather than prefix. */
const STATIC_INDEXES = {
  surveys: [
    { key: { active: 1, country_id: 1 }, name: 'active_1_country_id_1' },
    { key: { asset_id: 1 }, name: 'asset_id_1', unique: true }
  ],
  countries: [{ key: { code: 1 }, name: 'code_1', unique: true }],
  users: [{ key: { username: 1 }, name: 'username_1', unique: true }]
};

/**
 * Create whichever of `specs` the collection is missing, matching on index name.
 *
 * @returns {Promise<number>} how many were created
 */
async function ensure(collection, specs) {
  const existing = new Set((await collection.indexes()).map((i) => i.name));
  const missing = specs.filter((i) => !existing.has(i.name));

  if (missing.length === 0) {
    console.log(`  ✓ ${collection.collectionName} — complete`);
    return 0;
  }

  console.log(`  + ${collection.collectionName} — missing ${missing.length}: ${missing.map((i) => i.name).join(', ')}`);
  if (DRY_RUN) return 0;
  await collection.createIndexes(missing);
  return missing.length;
}

async function main() {
  console.log(`🔎 Checking indexes${DRY_RUN ? ' (dry run — nothing will be created)' : ''}...\n`);

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    console.log(`✓ Connected to MongoDB: ${MONGODB_DB}\n`);

    const names = (await db.listCollections().toArray()).map((c) => c.name).sort();
    let created = 0;
    let skippedEmpty = 0;

    for (const [name, specs] of Object.entries(STATIC_INDEXES)) {
      created += await ensure(db.collection(name), specs);
    }

    for (const name of names) {
      const prefix = Object.keys(INDEXES).find((p) => name.startsWith(p));
      if (!prefix) continue;

      const collection = db.collection(name);

      // An empty collection is one the pipeline has not populated yet. Indexing it is harmless
      // but noisy, and the pipeline creates its own on first write.
      if ((await collection.estimatedDocumentCount()) === 0) {
        skippedEmpty++;
        continue;
      }

      created += await ensure(collection, INDEXES[prefix]);
    }

    console.log(
      `\n${DRY_RUN ? '🔍 Dry run complete.' : '✅ Done.'} ` +
      `${created} index(es) created, ${skippedEmpty} empty collection(s) skipped.`
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('❌ Failed:', error.message);
  process.exit(1);
});
