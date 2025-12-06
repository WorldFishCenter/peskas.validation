/**
 * Airtable User Sync Library
 *
 * Provides functionality to sync users from Airtable to MongoDB.
 * Used by the API endpoint /api/admin/sync-users
 */

const { MongoClient } = require('mongodb');
const axios = require('axios');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_VALIDATION_URI;
const MONGODB_DB = process.env.MONGODB_VALIDATION_DB || 'validation-dev';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

// Generate a random password
function generatePassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Fetch all records from an Airtable table with pagination support
 */
async function fetchAirtableTable(tableName) {
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

    return allRecords;
  } catch (error) {
    console.error(`Error fetching ${tableName}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Build mapping from Airtable record IDs to KoboToolbox Form IDs
 */
async function buildFormIdMapping() {
  const formsRecords = await fetchAirtableTable('forms');

  const mapping = {};
  formsRecords.forEach(record => {
    const recordId = record.id;
    const koboFormId = record.fields['Form ID'] || record.fields.kobo_form_id || record.fields.form_id || record.fields.asset_id;

    if (koboFormId) {
      mapping[recordId] = koboFormId;
    }
  });

  return mapping;
}

/**
 * Build mapping from Airtable record IDs to Country Codes
 */
async function buildCountryMapping() {
  const countriesRecords = await fetchAirtableTable('countries');

  const mapping = {};
  countriesRecords.forEach(record => {
    const recordId = record.id;
    const countryCode = record.fields['Country'] || record.fields.code || record.fields.country_code;

    if (countryCode) {
      mapping[recordId] = countryCode;
    }
  });

  return mapping;
}

/**
 * Build mapping from Airtable record IDs to Kobo Usernames
 */
async function buildEnumeratorMapping() {
  const enumeratorsRecords = await fetchAirtableTable('enumerators');

  const mapping = {};
  enumeratorsRecords.forEach(record => {
    const recordId = record.id;
    const koboUsername = record.fields['Kobo Username'];

    if (koboUsername) {
      mapping[recordId] = koboUsername.trim();
    }
  });

  return mapping;
}

/**
 * Map Airtable record to user object
 */
function mapAirtableToUser(record, formIdMapping, countryMapping, enumeratorMapping) {
  const fields = record.fields;

  // Extract permissions
  const surveyIds = fields.asset ? fields.asset.map(formId => formIdMapping[formId]).filter(Boolean) : [];
  const enumeratorUsernames = fields.enumerators ? fields.enumerators.map(enumId => enumeratorMapping[enumId]).filter(Boolean) : [];
  const countryCodes = fields.country ? fields.country.map(countryId => countryMapping[countryId]).filter(Boolean) : [];

  // Map permission field to role
  const role = fields.permission?.toLowerCase() || 'user';

  return {
    username: fields.username?.toLowerCase().trim(),
    name: fields.user || fields.name || fields.full_name || fields.username,
    country: countryCodes,
    role: role,
    permissions: {
      surveys: surveyIds,
      enumerators: enumeratorUsernames
    }
  };
}

/**
 * Sync users from Airtable to MongoDB
 *
 * @returns {Promise<Object>} Result object with created, updated, deleted counts and generated passwords
 */
async function syncUsersFromAirtable() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_VALIDATION_URI not set in environment variables');
  }

  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
    throw new Error('AIRTABLE_BASE_ID and AIRTABLE_TOKEN must be set in environment variables');
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const usersCollection = db.collection('users');

    // Build mappings from related tables
    const formIdMapping = await buildFormIdMapping();
    const countryMapping = await buildCountryMapping();
    const enumeratorMapping = await buildEnumeratorMapping();

    // Fetch validation records from Airtable
    const airtableRecords = await fetchAirtableTable('validation');

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const generatedPasswords = [];

    for (const record of airtableRecords) {
      const userData = mapAirtableToUser(record, formIdMapping, countryMapping, enumeratorMapping);

      if (!userData.username) {
        skipped++;
        continue;
      }

      // Check if user already exists
      const existingUser = await usersCollection.findOne({
        username: userData.username
      });

      if (existingUser) {
        // Update existing user - preserve password, update role, permissions, name, and country
        await usersCollection.updateOne(
          { username: userData.username },
          {
            $set: {
              name: userData.name,
              country: userData.country,
              role: userData.role,
              permissions: userData.permissions,
              updated_at: new Date(),
              updated_by: 'airtable_sync'
            }
          }
        );

        updated++;
      } else {
        // Create new user with auto-generated password
        const password = generatePassword();
        const password_hash = await bcrypt.hash(password, 10);

        const newUser = {
          username: userData.username,
          name: userData.name,
          country: userData.country,
          role: userData.role,
          password_hash: password_hash,
          permissions: userData.permissions,
          active: true,
          created_at: new Date(),
          created_by: 'airtable_sync'
        };

        await usersCollection.insertOne(newUser);

        generatedPasswords.push({ username: userData.username, password });
        created++;
      }
    }

    // Delete users that exist in MongoDB but not in Airtable
    const airtableUsernames = airtableRecords
      .map(record => record.fields.username?.toLowerCase().trim())
      .filter(username => username);

    const usersToDelete = await usersCollection.find({
      username: { $nin: airtableUsernames },
      created_by: 'airtable_sync'
    }).toArray();

    let deleted = 0;
    if (usersToDelete.length > 0) {
      for (const user of usersToDelete) {
        await usersCollection.deleteOne({ _id: user._id });
        deleted++;
      }
    }

    return {
      created,
      updated,
      deleted,
      skipped,
      total: airtableRecords.length,
      generatedPasswords
    };

  } finally {
    await client.close();
  }
}

module.exports = {
  syncUsersFromAirtable
};
