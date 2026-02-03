import { MongoClient } from 'mongodb';
import axios from 'axios';
import dotenv from 'dotenv';
import { validateSchema } from '../lib/field-mapper.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_VALIDATION_URI;
const MONGODB_DB = process.env.MONGODB_VALIDATION_DB;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_VALIDATION_URI not set in environment variables');
  process.exit(1);
}

if (!MONGODB_DB) {
  console.error('Error: MONGODB_VALIDATION_DB not set in environment variables. Please set it in your .env file.');
  process.exit(1);
}

if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
  console.error('Error: AIRTABLE_BASE_ID and AIRTABLE_TOKEN must be set in .env');
  process.exit(1);
}

async function fetchAirtableForms() {
  console.log('Fetching forms from Airtable...');

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/forms`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`
      }
    });

    console.log(`✓ Found ${response.data.records.length} forms in Airtable`);
    return response.data.records;
  } catch (error) {
    console.error('Error fetching forms:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Validate Airtable schema before syncing to catch renamed columns early
 */
async function validateAirtableSchema() {
  console.log('🔍 Validating Airtable schema before sync...\n');

  // Fetch sample records from forms table (just 1 record is enough)
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/forms?maxRecords=1`;
  const response = await axios.get(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });

  const sampleRecords = response.data.records;

  // Validate schema
  const validation = validateSchema('forms', sampleRecords, 'surveys');

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

async function syncSurveys() {
  if (!MONGODB_URI) {
    console.error('ERROR: MONGODB_VALIDATION_URI not set');
    process.exit(1);
  }

  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
    console.error('ERROR: AIRTABLE_BASE_ID and AIRTABLE_TOKEN must be set in .env');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    // Validate Airtable schema before proceeding
    await validateAirtableSchema();

    // Fetch forms from Airtable
    const airtableForms = await fetchAirtableForms();

    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(MONGODB_DB);
    const surveysCollection = db.collection('surveys');

    console.log('\n=== Starting Survey Sync ===\n');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const form of airtableForms) {
      const fields = form.fields;
      const formId = fields['Form ID'];
      const formName = fields['Form Name'];
      const associatedCountries = fields['Associated Countries'];
      const status = fields['Status'];

      if (!formId) {
        console.log(`⚠️  Skipping form ${formName} - no Form ID`);
        skipped++;
        continue;
      }

      // Check if survey already exists
      const existingSurvey = await surveysCollection.findOne({
        asset_id: formId
      });

      const surveyDoc = {
        asset_id: formId,
        name: formName,
        country_id: associatedCountries,
        active: status === 'Deployed',
        updated_at: new Date()
      };

      if (existingSurvey) {
        // Update existing survey
        await surveysCollection.updateOne(
          { asset_id: formId },
          { $set: surveyDoc }
        );
        console.log(`✓ Updated: ${formName} (${formId})`);
        updated++;
      } else {
        // Create new survey
        surveyDoc.created_at = new Date();
        await surveysCollection.insertOne(surveyDoc);
        console.log(`✓ Created: ${formName} (${formId})`);
        created++;
      }
    }

    console.log('\n=== Sync Complete ===');
    console.log(`Created: ${created} surveys`);
    console.log(`Updated: ${updated} surveys`);
    console.log(`Skipped: ${skipped} forms`);
    console.log(`Total processed: ${airtableForms.length}`);

  } catch (error) {
    console.error('Sync error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nMongoDB connection closed');
  }
}

// Run the sync
syncSurveys();
