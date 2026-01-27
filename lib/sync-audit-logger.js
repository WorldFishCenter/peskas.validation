/**
 * Sync Audit Logger
 * Logs all sync operations to MongoDB for audit trail
 *
 * Creates persistent records of every sync operation including:
 * - Timestamp and duration
 * - Results (created, updated, deleted, failed)
 * - Error details
 * - Triggered by (user/cron/webhook)
 *
 * @module lib/sync-audit-logger
 */

const { getDb } = require('./db');
const { v4: uuidv4 } = require('uuid');

/**
 * Sync Audit Logger
 *
 * Tracks sync operations and logs results to MongoDB.
 * Provides persistent audit trail for debugging and compliance.
 */
class SyncAuditLogger {
  /**
   * Create a new audit logger for a sync operation
   *
   * @param {string} entityType - Type of entity being synced ('users', 'surveys', 'districts')
   * @param {string} triggeredBy - Who/what triggered the sync ('manual', 'cron', 'webhook', username)
   */
  constructor(entityType, triggeredBy = 'manual') {
    this.syncId = uuidv4();
    this.entityType = entityType;
    this.triggeredBy = triggeredBy;
    this.startTime = new Date();
    this.results = {
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      failed: 0
    };
    this.errors = [];
  }

  /**
   * Log sync completion to MongoDB
   *
   * Creates a record in the sync_audit_log collection with full details.
   *
   * @param {string} status - Sync status: 'success', 'failed', or 'partial'
   */
  async logCompletion(status = 'success') {
    const database = await getDb();
    const endTime = new Date();

    const logEntry = {
      sync_id: this.syncId,
      entity_type: this.entityType,
      triggered_by: this.triggeredBy,
      start_time: this.startTime,
      end_time: endTime,
      duration_ms: endTime - this.startTime,
      status, // 'success', 'failed', 'partial'
      results: this.results,
      errors: this.errors,
      airtable_snapshot: {
        record_count: this.results.created + this.results.updated + this.results.skipped,
        timestamp: this.startTime
      }
    };

    await database.collection('sync_audit_log').insertOne(logEntry);
    console.log(`📝 Audit log saved: ${this.syncId}`);
  }

  /**
   * Add error to log
   *
   * @param {Error} error - Error object
   * @param {string} recordId - Optional Airtable record ID that caused the error
   */
  addError(error, recordId = null) {
    this.errors.push({
      message: error.message,
      stack: error.stack,
      record_id: recordId,
      timestamp: new Date()
    });
  }

  /**
   * Update results counters
   *
   * @param {string} type - Type of result: 'created', 'updated', 'deleted', 'skipped', 'failed'
   */
  incrementResult(type) {
    if (this.results[type] !== undefined) {
      this.results[type]++;
    }
  }

  /**
   * Get summary string for logging
   *
   * @returns {string} Human-readable summary
   */
  getSummary() {
    return `Created: ${this.results.created}, Updated: ${this.results.updated}, Deleted: ${this.results.deleted}, Skipped: ${this.results.skipped}, Failed: ${this.results.failed}`;
  }
}

module.exports = { SyncAuditLogger };
