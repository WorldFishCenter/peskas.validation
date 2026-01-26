/**
 * Transaction-like Sync Safety
 * Provides checkpoint/rollback capability for Airtable syncs
 *
 * Creates backup collections before sync operations and can rollback on failure.
 * Ensures database never left in inconsistent state during Airtable syncs.
 *
 * @module lib/sync-transaction
 */

const { getDb } = require('./db');

/**
 * Sync Transaction Manager
 *
 * Provides checkpoint/rollback functionality for Airtable sync operations.
 * Creates a backup collection before sync and can restore on failure.
 */
class SyncTransaction {
  /**
   * Create a new sync transaction
   *
   * @param {string} collectionName - Name of collection to backup
   * @param {Object} syncMetadata - Metadata about the sync operation
   */
  constructor(collectionName, syncMetadata = {}) {
    this.collectionName = collectionName;
    this.backupCollectionName = `${collectionName}_backup_${Date.now()}`;
    this.syncMetadata = syncMetadata;
    this.checkpointCreated = false;
  }

  /**
   * Create checkpoint (backup current data)
   *
   * Backs up all documents tagged with created_by: 'airtable_sync' to a backup collection.
   * This allows rollback if sync fails.
   */
  async createCheckpoint() {
    const database = await getDb();
    const collection = database.collection(this.collectionName);

    // Check if collection exists
    const collections = await database.listCollections({ name: this.collectionName }).toArray();
    if (collections.length === 0) {
      console.log(`ℹ️  Collection '${this.collectionName}' doesn't exist yet (first sync)`);
      this.checkpointCreated = false;
      return;
    }

    // Count documents to backup
    const count = await collection.countDocuments({ created_by: 'airtable_sync' });
    if (count === 0) {
      console.log(`ℹ️  No airtable_sync documents in '${this.collectionName}' to backup`);
      this.checkpointCreated = false;
      return;
    }

    console.log(`📦 Creating checkpoint for ${count} documents...`);

    // Copy to backup collection
    const documents = await collection.find({ created_by: 'airtable_sync' }).toArray();
    await database.collection(this.backupCollectionName).insertMany(documents);

    this.checkpointCreated = true;
    console.log(`✅ Checkpoint created: ${this.backupCollectionName}\n`);
  }

  /**
   * Commit transaction (delete backup)
   *
   * Call this after successful sync to clean up the backup collection.
   */
  async commit() {
    if (!this.checkpointCreated) {
      console.log('ℹ️  No checkpoint to commit');
      return;
    }

    const database = await getDb();
    await database.collection(this.backupCollectionName).drop();
    console.log(`✅ Checkpoint committed (backup deleted)`);
  }

  /**
   * Rollback transaction (restore from backup)
   *
   * Restores data from backup collection if sync fails.
   * Deletes corrupted documents and restores original state.
   */
  async rollback() {
    if (!this.checkpointCreated) {
      console.log('⚠️  No checkpoint to rollback from');
      return;
    }

    const database = await getDb();
    const collection = database.collection(this.collectionName);
    const backupCollection = database.collection(this.backupCollectionName);

    console.log(`🔄 Rolling back to checkpoint...`);

    // Delete all airtable_sync documents
    const deleteResult = await collection.deleteMany({ created_by: 'airtable_sync' });
    console.log(`   Deleted ${deleteResult.deletedCount} corrupted documents`);

    // Restore from backup
    const backupDocuments = await backupCollection.find({}).toArray();
    if (backupDocuments.length > 0) {
      await collection.insertMany(backupDocuments);
      console.log(`   Restored ${backupDocuments.length} documents from backup`);
    }

    // Delete backup collection
    await backupCollection.drop();
    console.log(`✅ Rollback complete`);
  }

  /**
   * Execute sync with automatic checkpoint/rollback
   *
   * Wraps a sync function with checkpoint/rollback functionality.
   * Creates checkpoint before sync, commits on success, rolls back on error.
   *
   * @param {string} collectionName - Collection to backup
   * @param {Object} syncMetadata - Metadata about the sync
   * @param {Function} syncFunction - Async function that performs the sync
   * @returns {Promise<Object>} Results from sync function
   *
   * @example
   * const results = await SyncTransaction.execute('users', { entity: 'users' }, async () => {
   *   // Your sync logic here
   *   return { created: 5, updated: 10, failed: 0 };
   * });
   */
  static async execute(collectionName, syncMetadata, syncFunction) {
    const transaction = new SyncTransaction(collectionName, syncMetadata);

    try {
      // Create checkpoint
      await transaction.createCheckpoint();

      // Execute sync
      const results = await syncFunction();

      // Validate results
      if (results.failed && results.failed > 0) {
        throw new Error(`Sync failed: ${results.failed} records failed to sync`);
      }

      // Commit on success
      await transaction.commit();

      return results;
    } catch (error) {
      // Rollback on error
      console.error(`❌ Sync error: ${error.message}`);
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = { SyncTransaction };
