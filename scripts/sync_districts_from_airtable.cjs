/**
 * Sync Districts from Airtable to MongoDB (SIMPLIFIED VERSION)
 *
 * Fetches district data from Airtable "districts" table and syncs to MongoDB.
 * Now reads Asset ID directly as text field (no complex linked record mapping).
 *
 * Usage: node scripts/sync_districts_from_airtable.cjs
 */

const { MongoClient } = require('mongodb');
const axios = require('axios');
const dotenv = require('dotenv');
const { validateSchema } = require('../lib/field-mapper');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_VALIDATION_URI;
const MONGODB_DB = process.env.MONGODB_VALIDATION_DB;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

// Validate environment variables
if (!MONGODB_URI || !MONGODB_DB) {
  console.error('❌ ERROR: MONGODB_VALIDATION_URI and MONGODB_VALIDATION_DB must be set');
  process.exit(1);
}

if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
  console.error('❌ ERROR: AIRTABLE_BASE_ID and AIRTABLE_TOKEN must be set');
  process.exit(1);
}

/**
 * Fetch all records from Airtable table with pagination
 */
async function fetchAirtableTable(tableName) {
  console.log(`Fetching ${tableName} from Airtable...`);

  const allRecords = [];
  let offset = null;

  try {
    do {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}${offset ? `?offset=${offset}` : ''}`;
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`
        }
      });

      allRecords.push(...response.data.records);
      offset = response.data.offset;
    } while (offset);

    console.log(`✓ Found ${allRecords.length} records in ${tableName}`);
    return allRecords;
  } catch (error) {
    console.error(`❌ Error fetching ${tableName}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Parse Asset ID field (handles single or multiple asset_ids)
 * Input: "ajEruvFJCzmi4cmWs9PAc" or "ajEruvFJCzmi4cmWs9PAc, acbfEuAzqAnCGm8Mqenr56"
 * Output: ["ajEruvFJCzmi4cmWs9PAc"] or ["ajEruvFJCzmi4cmWs9PAc", "acbfEuAzqAnCGm8Mqenr56"]
 */
function parseAssetIds(assetIdString) {
  if (!assetIdString) return [];

  return assetIdString
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
}

/**
 * Build a mapping of Airtable country record ID → country_id
 * Example: { "recABC123": "kenya", "recXYZ789": "mozambique" }
 */
async function buildCountryMapping() {
  try {
    const countries = await fetchAirtableTable('countries');
    const mapping = {};

    for (const record of countries) {
      const fields = record.fields;
      // Extract country name or code from Airtable
      const countryName = fields['Country'] || fields['Name'] || fields['name'];
      const countryCode = fields['Code'] || fields['code'];

      // Convert to lowercase country_id (e.g., "Kenya" → "kenya", "MZ" → "mozambique")
      let country_id = null;

      if (countryCode) {
        // Map country codes to country_id
        const codeUpper = countryCode.toUpperCase();
        if (codeUpper === 'KE' || codeUpper === 'KEN') country_id = 'kenya';
        else if (codeUpper === 'MZ' || codeUpper === 'MOZ') country_id = 'mozambique';
        else if (codeUpper === 'TZ' || codeUpper === 'TZA' || codeUpper === 'ZAN') country_id = 'zanzibar';
        else if (codeUpper === 'TL' || codeUpper === 'TLS' || codeUpper === 'TIM') country_id = 'timor';
      }

      // Fallback: Try country name
      if (!country_id && countryName) {
        const nameLower = countryName.toLowerCase();
        if (nameLower.includes('kenya')) country_id = 'kenya';
        else if (nameLower.includes('mozambique')) country_id = 'mozambique';
        else if (nameLower.includes('zanzibar')) country_id = 'zanzibar';
        else if (nameLower.includes('timor')) country_id = 'timor';
      }

      if (country_id) {
        mapping[record.id] = country_id;
      }
    }

    console.log(`✓ Built country mapping: ${Object.keys(mapping).length} countries`);
    return mapping;
  } catch (error) {
    console.warn('⚠️  Could not fetch countries table from Airtable:', error.message);
    console.warn('   Will fall back to parsing district codes');
    return {};
  }
}

/**
 * Derive country_id from District Code (e.g., "ZAN-1" → "zanzibar") - FALLBACK ONLY
 */
function deriveCountryFromDistrictCode(districtCode) {
  if (!districtCode) return null;

  const code = districtCode.toUpperCase();

  if (code.startsWith('ZAN-')) return 'zanzibar';
  if (code.startsWith('MOZ-')) return 'mozambique';
  if (code.startsWith('KEN-') || code.startsWith('KEY-')) return 'kenya';
  if (code.startsWith('TLS-') || code.startsWith('TIM-')) return 'timor';

  return null;
}

/**
 * Map Airtable district record to MongoDB document (IMPROVED)
 * @param {Object} record - Airtable district record
 * @param {Object} countryMapping - Map of Airtable country record ID → country_id (e.g., { "recABC123": "kenya" })
 */
function mapAirtableToDistrict(record, countryMapping = {}) {
  const fields = record.fields;

  // Extract fields (handle various naming conventions)
  const code = fields['FAO District (Gaul 2 Code)'] || fields['Gaul 2 Code'] || fields['gaul_2'] || fields['code'];
  const name = fields['District'] || fields['Gaul 2 Name'] || fields['gaul_2_name'] || fields['name'];
  const districtCode = fields['District Code'] || fields['district_code'];

  // Read Asset ID as text (no more linked record complexity!)
  const assetIdString = fields['Asset ID'] || fields['asset_id'];
  const asset_ids = parseAssetIds(assetIdString);

  // Derive country - PRIMARY: Use linked Country field, FALLBACK: Parse District Code
  let country_id = null;

  // Try to get country from linked "Country" field (returns array of Airtable record IDs)
  const countryLinks = fields['Country'] || fields['country'];
  if (countryLinks && Array.isArray(countryLinks) && countryLinks.length > 0) {
    const countryRecordId = countryLinks[0]; // Take first linked country
    country_id = countryMapping[countryRecordId];
  }

  // Fallback: Parse district code if country not found via linked field
  if (!country_id) {
    country_id = deriveCountryFromDistrictCode(districtCode);
  }

  return {
    code: code ? String(code).trim() : null,
    name: name ? String(name).trim() : null,
    country_id: country_id,
    district_code: districtCode ? String(districtCode).trim() : null,
    asset_ids: asset_ids, // Array of asset_ids (can be multiple!)
    active: true,
    metadata: {
      airtable_record_id: record.id,
      last_synced: new Date()
    }
  };
}

/**
 * Validate Airtable schema before syncing to catch renamed columns early
 */
async function validateAirtableSchema() {
  console.log('🔍 Validating Airtable schema before sync...\n');

  // Fetch sample records from districts table (just 1 record is enough)
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/districts?maxRecords=1`;
  const response = await axios.get(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });

  const sampleRecords = response.data.records;

  // Validate schema
  const validation = validateSchema('districts', sampleRecords, 'districts');

  // Print warnings
  if (validation.warnings.length > 0) {
    console.log('⚠️  Schema warnings:');
    validation.warnings.forEach(w => console.log(`   - ${w}`));
    console.log('');
  }

  // Fail fast on errors
  if (!validation.valid) {
    console.error('❌ Schema validation failed:');
    validation.errors.forEach(e => console.error(`   - ${e}`));
    console.error('\n💡 Tip: Check if Airtable column names were renamed.');
    console.error('   Update config/airtable-field-mappings.json with new names.\n');
    throw new Error('Airtable schema validation failed. Aborting sync to prevent data corruption.');
  }

  console.log('✅ Schema validation passed\n');
}

/**
 * Main sync function
 */
async function syncDistricts() {
  const client = new MongoClient(MONGODB_URI);

  try {
    // Validate Airtable schema before proceeding
    await validateAirtableSchema();

    // Build country mapping from Airtable countries table
    console.log('Building country mapping from Airtable...');
    const countryMapping = await buildCountryMapping();

    // Fetch districts from Airtable
    const airtableRecords = await fetchAirtableTable('districts');

    // Connect to MongoDB
    await client.connect();
    console.log('\n✓ Connected to MongoDB');

    const db = client.db(MONGODB_DB);
    const districtsCollection = db.collection('districts');

    console.log('\n=== Starting Districts Sync ===\n');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const record of airtableRecords) {
      const districtData = mapAirtableToDistrict(record, countryMapping);

      // Validate required fields
      if (!districtData.code || !districtData.name) {
        console.log(`⚠️  Skipping record ${record.id} - missing code or name`);
        skipped++;
        continue;
      }

      if (!districtData.country_id) {
        console.log(`⚠️  Skipping ${districtData.code} - ${districtData.name} - could not derive country_id from district_code: ${districtData.district_code}`);
        skipped++;
        continue;
      }

      if (!districtData.asset_ids || districtData.asset_ids.length === 0) {
        console.log(`⚠️  Skipping ${districtData.code} - ${districtData.name} - no asset_ids found`);
        skipped++;
        continue;
      }

      // Check if district already exists
      const existingDistrict = await districtsCollection.findOne({
        code: districtData.code
      });

      if (existingDistrict) {
        // Update existing district
        await districtsCollection.updateOne(
          { code: districtData.code },
          {
            $set: {
              name: districtData.name,
              country_id: districtData.country_id,
              district_code: districtData.district_code,
              asset_ids: districtData.asset_ids,
              active: districtData.active,
              metadata: districtData.metadata,
              updated_at: new Date(),
              updated_by: 'airtable_sync'
            }
          }
        );
        const assetIdDisplay = districtData.asset_ids.join(', ');
        console.log(`✓ Updated: ${districtData.code} - ${districtData.name} [${districtData.district_code}] [${districtData.country_id}] → ${assetIdDisplay}`);
        updated++;
      } else {
        // Create new district
        const newDistrict = {
          ...districtData,
          created_at: new Date(),
          created_by: 'airtable_sync',
          updated_at: new Date(),
          updated_by: 'airtable_sync'
        };

        await districtsCollection.insertOne(newDistrict);
        const assetIdDisplay = districtData.asset_ids.join(', ');
        console.log(`✓ Created: ${districtData.code} - ${districtData.name} [${districtData.district_code}] [${districtData.country_id}] → ${assetIdDisplay}`);
        created++;
      }
    }

    // Delete districts that exist in MongoDB but not in Airtable
    // Only delete those created by airtable_sync
    const airtableCodes = airtableRecords
      .map(record => {
        const mapped = mapAirtableToDistrict(record, countryMapping);
        return mapped.code;
      })
      .filter(code => code !== null);

    const districtsToDelete = await districtsCollection.find({
      code: { $nin: airtableCodes },
      created_by: 'airtable_sync'
    }).toArray();

    let deleted = 0;
    if (districtsToDelete.length > 0) {
      console.log('\n=== Removing districts not in Airtable ===');
      for (const district of districtsToDelete) {
        await districtsCollection.deleteOne({ _id: district._id });
        console.log(`✗ Deleted: ${district.code} - ${district.name} (no longer in Airtable)`);
        deleted++;
      }
    }

    console.log('\n=== Sync Complete ===');
    console.log(`Created: ${created} districts`);
    console.log(`Updated: ${updated} districts`);
    console.log(`Deleted: ${deleted} districts`);
    console.log(`Skipped: ${skipped} records`);
    console.log(`Total processed: ${airtableRecords.length}`);

    // Create indexes if they don't exist
    console.log('\n=== Creating indexes ===');
    try {
      await districtsCollection.createIndex({ code: 1 }, { unique: true });
      console.log('✓ Created unique index on code');

      await districtsCollection.createIndex({ country_id: 1 });
      console.log('✓ Created index on country_id');

      await districtsCollection.createIndex({ asset_ids: 1 });
      console.log('✓ Created index on asset_ids');

      await districtsCollection.createIndex({ active: 1 });
      console.log('✓ Created index on active');

      await districtsCollection.createIndex({ code: 1, active: 1 });
      console.log('✓ Created compound index on code + active');
    } catch (error) {
      // Indexes may already exist
      if (error.code === 85) {
        console.log('✓ Indexes already exist');
      } else {
        console.error('⚠️  Error creating indexes:', error.message);
      }
    }

  } catch (error) {
    console.error('\n❌ Sync error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✓ MongoDB connection closed');
  }
}

// Run the sync
syncDistricts();
