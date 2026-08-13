/**
 * Sync Countries from Airtable to MongoDB
 *
 * Usage: node scripts/sync_countries_from_airtable.cjs
 *
 * Why this script exists
 * ----------------------
 * The `countries` collection was the one entity that Airtable data flowed *through* but never
 * *into*. `sync_districts_from_airtable.cjs` already fetches the Airtable `countries` table, but
 * only to build an in-memory record-id → country mapping for districts; nothing ever wrote the
 * collection. Its three rows were created once by an external one-off (`created_by:
 * "sync_script"`, a script not present in this repo) and had been frozen ever since — which is
 * why adding Timor surveys in Airtable produced no Timor country in the portal.
 *
 * Scope: only countries that have at least one form
 * -------------------------------------------------
 * The Airtable table lists 10 countries, six of which have no forms (Bangladesh, Tanzania,
 * Malaysia, India, Egypt, Malawi). A full-access admin sees *all* active countries, so syncing
 * every row would put six empty countries in their picker. Only countries with a linked form are
 * synced; the rest are reported and skipped.
 *
 * Never deletes. Countries present in MongoDB but absent from (or formless in) Airtable are
 * reported, not removed — deleting one would strip access for every user holding its surveys.
 */

const { MongoClient } = require('mongodb');
const axios = require('axios');
const dotenv = require('dotenv');
const { toCanonicalCountry } = require('../lib/country-codes');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_VALIDATION_URI;
const MONGODB_DB = process.env.MONGODB_VALIDATION_DB;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

if (!MONGODB_URI || !MONGODB_DB) {
  console.error('❌ ERROR: MONGODB_VALIDATION_URI and MONGODB_VALIDATION_DB must be set');
  process.exit(1);
}

if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
  console.error('❌ ERROR: AIRTABLE_BASE_ID and AIRTABLE_TOKEN must be set');
  process.exit(1);
}

/**
 * Fetch all records from an Airtable table, following pagination.
 *
 * @param {string} tableName
 * @returns {Promise<Array<Object>>}
 */
async function fetchAirtableTable(tableName) {
  console.log(`Fetching ${tableName} from Airtable...`);

  const allRecords = [];
  let offset = null;

  do {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}${offset ? `?offset=${offset}` : ''}`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });
    allRecords.push(...response.data.records);
    offset = response.data.offset;
  } while (offset);

  console.log(`✓ Found ${allRecords.length} records in ${tableName}`);
  return allRecords;
}

async function main() {
  console.log('🌍 Syncing countries from Airtable...\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    console.log(`✓ Connected to MongoDB: ${MONGODB_DB}\n`);

    const records = await fetchAirtableTable('countries');

    const withForms = [];
    const withoutForms = [];

    for (const record of records) {
      const name = record.fields.Country || record.fields.Name || record.fields.name;
      if (!name) continue;
      // "Current Form" links the country to its KoboToolbox forms.
      const formCount = (record.fields['Current Form'] || []).length;
      (formCount > 0 ? withForms : withoutForms).push({ name, formCount });
    }

    if (withoutForms.length > 0) {
      console.log(`\nSkipping ${withoutForms.length} country/countries with no linked form:`);
      console.log(`  ${withoutForms.map((c) => c.name).join(', ')}`);
    }

    console.log(`\nSyncing ${withForms.length} country/countries with forms:\n`);

    const existing = await db.collection('countries').find({}).toArray();
    let created = 0;
    let updated = 0;

    for (const { name, formCount } of withForms) {
      const canonical = toCanonicalCountry(name);
      // Match on the canonical code, not the raw string: `countries.code` has a case-sensitive
      // unique index, so a raw match would happily insert "Timor-Leste" alongside "Timor".
      const match = existing.find((c) => toCanonicalCountry(c.code) === canonical);
      const now = new Date();

      if (match) {
        await db.collection('countries').updateOne(
          { _id: match._id },
          { $set: { name, active: true, updated_at: now, updated_by: 'sync_countries_script' } }
        );
        updated++;
        console.log(`  ~ ${String(name).padEnd(14)} (${formCount} form(s))  → updated existing code "${match.code}"`);
      } else {
        // Store the canonical code so the collection cannot drift out of step with itself.
        await db.collection('countries').insertOne({
          code: canonical,
          name,
          active: true,
          created_at: now,
          created_by: 'sync_countries_script',
          updated_at: now,
          updated_by: 'sync_countries_script'
        });
        created++;
        console.log(`  + ${String(name).padEnd(14)} (${formCount} form(s))  → created code "${canonical}"`);
      }
    }

    // Report, never delete.
    const canonicalFromAirtable = new Set(withForms.map((c) => toCanonicalCountry(c.name)));
    const orphans = existing.filter((c) => !canonicalFromAirtable.has(toCanonicalCountry(c.code)));
    if (orphans.length > 0) {
      console.log(`\n⚠️  In MongoDB but not in Airtable (left untouched — delete by hand if intended):`);
      orphans.forEach((c) => console.log(`     ${c.code}`));
    }

    console.log(`\n✅ Done. ${created} created, ${updated} updated.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('❌ Sync failed:', error.response?.data || error.message);
  process.exit(1);
});
