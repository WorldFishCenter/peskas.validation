/**
 * Sync Users from Airtable to MongoDB (ES6 wrapper)
 *
 * This is an ES6 wrapper around the shared sync implementation.
 * Uses the canonical sync logic from lib/airtable-sync-users.js
 *
 * Usage: node scripts/sync_users_from_airtable.js
 */

import dotenv from 'dotenv';
import axios from 'axios';
import { createRequire } from 'module';
import { validateSchema } from '../lib/field-mapper.js';

dotenv.config();

const require = createRequire(import.meta.url);
const { syncUsersFromAirtable } = require('../lib/airtable-sync-users');

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

/**
 * Fetch a sample record from Airtable table for schema validation
 */
async function fetchSampleRecord(tableName) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}?maxRecords=1`;
  const response = await axios.get(url, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });
  return response.data.records;
}

/**
 * Validate Airtable schema before syncing to catch renamed columns early
 */
async function validateAirtableSchema() {
  console.log('🔍 Validating Airtable schema before sync...\n');

  // Fetch sample records from validation table
  const sampleRecords = await fetchSampleRecord('validation');

  // Validate schema
  const validation = validateSchema('validation', sampleRecords, 'users');

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
 * Main function
 */
async function main() {
  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
    console.error('ERROR: AIRTABLE_BASE_ID and AIRTABLE_TOKEN must be set in .env');
    process.exit(1);
  }

  try {
    // Validate Airtable schema before proceeding
    await validateAirtableSchema();

    console.log('🚀 Starting user sync from Airtable...\n');

    // Call shared sync implementation
    const results = await syncUsersFromAirtable({ verbose: true });

    if (results.generatedPasswords.length > 0) {
      console.log('\n=== Generated Passwords ===');
      console.log('Save these passwords securely!');
      results.generatedPasswords.forEach(({ username, password }) => {
        console.log(`${username}: ${password}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  }
}

// Run the sync
main();
