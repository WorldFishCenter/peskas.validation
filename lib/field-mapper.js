/**
 * Field Mapper Utility
 * Centralized Airtable field mapping with fallbacks and validation
 *
 * Provides consistent field mapping from Airtable to MongoDB across all sync scripts.
 * Handles column name changes gracefully using fallback field names.
 *
 * @module lib/field-mapper
 */

const fs = require('fs');
const path = require('path');

// Load configuration
const FIELD_MAPPINGS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/airtable-field-mappings.json'), 'utf8')
);

/**
 * Validate that Airtable schema matches expected field names
 *
 * Checks that all required fields have at least one matching column in Airtable.
 * Use this BEFORE syncing to detect renamed columns early.
 *
 * @param {string} tableName - Airtable table name (for error messages)
 * @param {Array} sampleRecords - Sample records from Airtable
 * @param {string} entityType - 'users', 'surveys', or 'districts'
 * @returns {Object} { valid: boolean, errors: Array<string>, warnings: Array<string> }
 *
 * @example
 * const validation = validateSchema('validation', airtableRecords, 'users');
 * if (!validation.valid) {
 *   console.error('Schema validation failed:', validation.errors);
 *   throw new Error('Aborting sync');
 * }
 */
function validateSchema(tableName, sampleRecords, entityType) {
  const entityConfig = FIELD_MAPPINGS[entityType];
  const errors = [];
  const warnings = [];

  if (sampleRecords.length === 0) {
    warnings.push(`No records found in table '${tableName}' to validate schema`);
    return { valid: true, errors, warnings };
  }

  const sampleFields = Object.keys(sampleRecords[0].fields);

  // Check each required field has at least one matching Airtable field
  for (const [mongoField, config] of Object.entries(entityConfig)) {
    if (!config.required) continue;

    const foundMatch = config.airtable_fields.some(f => sampleFields.includes(f));
    if (!foundMatch) {
      errors.push(
        `Required field '${mongoField}' not found in Airtable table '${tableName}'. ` +
        `Tried: ${config.airtable_fields.join(', ')}. ` +
        `Available fields: ${sampleFields.join(', ')}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  validateSchema
};
