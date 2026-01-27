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
 * Map Airtable record fields to MongoDB document
 *
 * @param {string} entityType - 'users', 'surveys', or 'districts'
 * @param {Object} airtableRecord - Airtable record with .fields property
 * @param {Object} mappingTables - Pre-built mapping objects (formId→assetId, etc)
 * @returns {Object} { mapped: Object, warnings: Array<string> }
 * @throws {Error} If required fields missing or validation fails
 *
 * @example
 * const result = mapFields('users', airtableRecord, { forms: {...}, countries: {...} });
 * console.log(result.mapped); // { username: 'john_doe', email: '...' }
 * console.log(result.warnings); // ['Field X not found, using fallback Y']
 */
function mapFields(entityType, airtableRecord, mappingTables = {}) {
  const entityConfig = FIELD_MAPPINGS[entityType];
  if (!entityConfig) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  const mapped = {};
  const errors = [];
  const warnings = [];

  for (const [mongoField, config] of Object.entries(entityConfig)) {
    const { airtable_fields, required, validation, mapping, mapping_table, allowed_values } = config;

    // Try each field name in fallback order
    let value = null;

    for (const airtableField of airtable_fields) {
      if (airtableRecord.fields[airtableField] !== undefined) {
        value = airtableRecord.fields[airtableField];
        break;
      }
    }

    // Handle missing required fields
    if (value === null || value === undefined || value === '') {
      if (required) {
        errors.push(`Required field '${mongoField}' not found. Tried: ${airtable_fields.join(', ')}`);
      }
      continue;
    }

    // Apply validation
    if (validation) {
      const validationResult = validateField(mongoField, value, validation);
      if (!validationResult.valid) {
        errors.push(`Field '${mongoField}' validation failed: ${validationResult.error}`);
        continue;
      }
      value = validationResult.value; // May be transformed (e.g., trimmed, lowercased)
    }

    // Check allowed values
    if (allowed_values && !allowed_values.includes(value)) {
      errors.push(`Field '${mongoField}' has invalid value '${value}'. Allowed: ${allowed_values.join(', ')}`);
      continue;
    }

    // Apply value mapping (e.g., "Deployed" → true)
    if (mapping && typeof value === 'string' && mapping[value] !== undefined) {
      value = mapping[value];
    }

    // Apply table mapping (e.g., Airtable record ID → MongoDB value)
    if (mapping_table && mappingTables[mapping_table]) {
      if (Array.isArray(value)) {
        // Handle linked records (array of Airtable IDs)
        const originalLength = value.length;
        value = value.map(id => mappingTables[mapping_table][id]).filter(Boolean);
        if (value.length === 0 && required) {
          warnings.push(`Linked records for '${mongoField}' produced empty array after mapping`);
        } else if (value.length < originalLength) {
          warnings.push(`Some linked records for '${mongoField}' could not be mapped (${value.length}/${originalLength} successful)`);
        }
      } else {
        // Handle single linked record
        const mappedValue = mappingTables[mapping_table][value];
        if (!mappedValue && required) {
          errors.push(`Failed to map '${mongoField}' ID '${value}' using mapping table '${mapping_table}'`);
          continue;
        }
        value = mappedValue;
      }
    }

    mapped[mongoField] = value;
  }

  // Throw if any errors
  if (errors.length > 0) {
    const error = new Error(`Field mapping failed for ${entityType} record ${airtableRecord.id}`);
    error.details = { errors, warnings, record: airtableRecord.id };
    throw error;
  }

  return { mapped, warnings };
}

/**
 * Validate field value based on validation type
 *
 * @param {string} fieldName - Name of field being validated
 * @param {*} value - Value to validate
 * @param {string} validationType - Type of validation to apply
 * @returns {Object} { valid: boolean, value: *, error?: string }
 */
function validateField(fieldName, value, validationType) {
  switch (validationType) {
    case 'lowercase_trim':
      return { valid: true, value: String(value).toLowerCase().trim() };

    case 'email_format': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const trimmed = String(value).trim();
      if (!emailRegex.test(trimmed)) {
        return { valid: false, error: 'Invalid email format' };
      }
      return { valid: true, value: trimmed };
    }

    case 'alphanumeric': {
      const alphanumericRegex = /^[a-zA-Z0-9_-]+$/;
      if (!alphanumericRegex.test(String(value))) {
        return { valid: false, error: 'Must be alphanumeric (letters, numbers, _, -)' };
      }
      return { valid: true, value: String(value) };
    }

    case 'numeric': {
      const numericRegex = /^\d+$/;
      const strValue = String(value);
      if (!numericRegex.test(strValue)) {
        return { valid: false, error: 'Must be numeric' };
      }
      return { valid: true, value: strValue };
    }

    case 'comma_separated': {
      if (!value) return { valid: true, value: [] };
      const items = String(value).split(',').map(s => s.trim()).filter(Boolean);
      return { valid: true, value: items };
    }

    default:
      return { valid: true, value };
  }
}

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
  mapFields,
  validateField,
  validateSchema,
  FIELD_MAPPINGS
};
