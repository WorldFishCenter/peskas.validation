/**
 * Airtable User Sync Library
 *
 * Provides functionality to sync users from Airtable to MongoDB.
 * Used by the API endpoint /api/admin/sync-users
 *
 * This module is a thin wrapper around the shared sync implementation
 * in lib/airtable-sync-users.js
 *
 * @module lib/airtable-sync
 */

const { syncUsersFromAirtable } = require('./airtable-sync-users');

module.exports = {
  syncUsersFromAirtable
};
