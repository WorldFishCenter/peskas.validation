/**
 * Sync Lock Manager
 * Prevents concurrent syncs using MongoDB
 *
 * Uses MongoDB collection as a distributed lock to ensure only one sync
 * runs at a time for each entity type. Includes automatic expiry for stale locks.
 *
 * @module lib/sync-lock
 */

const { getDb } = require('./db');

/**
 * Sync Lock
 *
 * Distributed lock system using MongoDB to prevent concurrent syncs.
 * Locks expire automatically after 10 minutes to handle crashed processes.
 */
class SyncLock {
  /**
   * Acquire a lock for syncing an entity type
   *
   * @param {string} entityType - Entity type ('users', 'surveys', 'districts')
   * @param {string} lockedBy - Who is acquiring the lock (username, 'cron', 'webhook')
   * @returns {Promise<boolean>} true if lock acquired, false if already locked
   */
  static async acquire(entityType, lockedBy) {
    const database = await getDb();
    const locksCollection = database.collection('system_locks');

    const lockKey = `sync_${entityType}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    try {
      // Try to acquire lock (upsert with condition that it's not already locked or expired)
      const result = await locksCollection.findOneAndUpdate(
        {
          key: lockKey,
          $or: [
            { locked: false },
            { expires_at: { $lt: now } } // Expired locks can be reacquired
          ]
        },
        {
          $set: {
            locked: true,
            locked_at: now,
            locked_by: lockedBy,
            expires_at: expiresAt
          }
        },
        {
          upsert: true,
          returnDocument: 'after'
        }
      );

      // If we got a document back, we acquired the lock
      return result.value !== null;
    } catch (error) {
      // If upsert fails due to race condition, lock is held by someone else
      if (error.code === 11000) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Release a lock
   *
   * @param {string} entityType - Entity type ('users', 'surveys', 'districts')
   */
  static async release(entityType) {
    const database = await getDb();
    await database.collection('system_locks').updateOne(
      { key: `sync_${entityType}` },
      { $set: { locked: false } }
    );
  }

  /**
   * Execute a function with automatic lock acquisition and release
   *
   * Acquires lock, executes function, and releases lock even if function throws.
   * Provides clear error message if lock is already held.
   *
   * @param {string} entityType - Entity type ('users', 'surveys', 'districts')
   * @param {string} lockedBy - Who is acquiring the lock
   * @param {Function} syncFunction - Async function to execute with lock held
   * @returns {Promise<*>} Result from syncFunction
   * @throws {Error} If lock already held by another process
   *
   * @example
   * await SyncLock.executeWithLock('users', 'admin', async () => {
   *   await syncUsersFromAirtable();
   * });
   */
  static async executeWithLock(entityType, lockedBy, syncFunction) {
    const acquired = await this.acquire(entityType, lockedBy);

    if (!acquired) {
      throw new Error(
        `Sync already in progress for ${entityType}. ` +
        `Please wait for it to complete or check for stale locks.`
      );
    }

    try {
      console.log(`🔒 Lock acquired for ${entityType} sync by ${lockedBy}`);
      return await syncFunction();
    } finally {
      await this.release(entityType);
      console.log(`🔓 Lock released for ${entityType} sync`);
    }
  }

  /**
   * Check if a sync is currently locked
   *
   * @param {string} entityType - Entity type to check
   * @returns {Promise<Object|null>} Lock info if locked, null if available
   */
  static async checkLock(entityType) {
    const database = await getDb();
    const lock = await database.collection('system_locks').findOne({
      key: `sync_${entityType}`,
      locked: true,
      expires_at: { $gt: new Date() } // Only return non-expired locks
    });

    return lock;
  }

  /**
   * Force release a lock (use with caution!)
   *
   * @param {string} entityType - Entity type to force unlock
   */
  static async forceRelease(entityType) {
    console.warn(`⚠️  Force releasing lock for ${entityType}`);
    await this.release(entityType);
  }
}

module.exports = { SyncLock };
