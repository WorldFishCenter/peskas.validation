const { getDb } = require('./db');

const COLLECTION = 'rate_limits';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Guards one-time index creation. @type {Promise<void>|null} */
let indexReady = null;

/**
 * Ensure the lookup index and a TTL that reaps spent counters.
 *
 * Without the TTL the collection grew without bound — nothing ever deleted a counter — and
 * without the compound index every check was a collection scan.
 *
 * @param {import('mongodb').Db} db
 * @returns {Promise<void>}
 */
function ensureIndexes(db) {
  if (!indexReady) {
    const col = db.collection(COLLECTION);
    indexReady = Promise.all([
      col.createIndex({ identifier: 1, type: 1 }),
      // Counters are meaningless once their window has long passed; 7 days is comfortably
      // beyond the longest window in use (24h).
      col.createIndex({ window_start: 1 }, { expireAfterSeconds: 7 * DAY_MS / 1000 })
    ]).then(() => undefined).catch(error => {
      indexReady = null; // let a later call retry
      throw error;
    });
  }
  return indexReady;
}

/**
 * Count an attempt against a sliding window and report whether it is allowed.
 *
 * Use for actions where every request should count (e.g. password-reset requests).
 *
 * @param {string} identifier - IP address, user id, username — whatever is being limited
 * @param {string} type - Namespace, so different limits on the same identifier don't collide
 * @param {number} maxRequests - Requests permitted per window
 * @param {number} [windowMs] - Window length, default 24h
 * @returns {Promise<{allowed: boolean, remaining: number, retryAfter?: number}>}
 */
async function consumeRateLimit(identifier, type, maxRequests = 3, windowMs = DAY_MS) {
  const db = await getDb();
  await ensureIndexes(db);
  const col = db.collection(COLLECTION);
  const now = new Date();

  const record = await col.findOne({ identifier, type });

  if (!record) {
    await col.insertOne({
      identifier, type, count: 1, window_start: now, last_request: now, created_at: now
    });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  // Window elapsed - start a fresh one.
  if (record.window_start.getTime() < now.getTime() - windowMs) {
    await col.updateOne(
      { _id: record._id },
      { $set: { count: 1, window_start: now, last_request: now } }
    );
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    const windowEnd = record.window_start.getTime() + windowMs;
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000))
    };
  }

  await col.updateOne({ _id: record._id }, { $inc: { count: 1 }, $set: { last_request: now } });
  return { allowed: true, remaining: maxRequests - record.count - 1 };
}

/**
 * Report whether an identifier is currently over its limit, without counting an attempt.
 *
 * Pairs with {@link recordFailure} for auth: a *successful* login should not consume budget,
 * so the check and the increment are separate.
 *
 * Fails **open**. This limit is defence-in-depth against brute force; a misbehaving counter
 * store must not lock legitimate users out of the portal.
 *
 * @param {string} identifier
 * @param {string} type
 * @param {number} maxAttempts
 * @param {number} windowMs
 * @returns {Promise<{allowed: boolean, retryAfter?: number}>}
 */
async function isWithinLimit(identifier, type, maxAttempts, windowMs) {
  try {
    const db = await getDb();
    await ensureIndexes(db);
    const record = await db.collection(COLLECTION).findOne({ identifier, type });
    if (!record) return { allowed: true };

    const now = Date.now();
    if (record.window_start.getTime() < now - windowMs) return { allowed: true };
    if (record.count < maxAttempts) return { allowed: true };

    const windowEnd = record.window_start.getTime() + windowMs;
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((windowEnd - now) / 1000)) };
  } catch (error) {
    console.error('[RATE_LIMIT] check failed, allowing request:', error.message);
    return { allowed: true };
  }
}

/**
 * Count one failed attempt.
 *
 * @param {string} identifier
 * @param {string} type
 * @param {number} windowMs
 * @returns {Promise<void>}
 */
async function recordFailure(identifier, type, windowMs) {
  try {
    const db = await getDb();
    const col = db.collection(COLLECTION);
    const now = new Date();
    const record = await col.findOne({ identifier, type });

    if (!record || record.window_start.getTime() < now.getTime() - windowMs) {
      await col.updateOne(
        { identifier, type },
        { $set: { count: 1, window_start: now, last_request: now }, $setOnInsert: { created_at: now } },
        { upsert: true }
      );
      return;
    }

    await col.updateOne({ _id: record._id }, { $inc: { count: 1 }, $set: { last_request: now } });
  } catch (error) {
    console.error('[RATE_LIMIT] failed to record attempt:', error.message);
  }
}

/**
 * Clear an identifier's counter, e.g. after a successful login.
 *
 * @param {string} identifier
 * @param {string} type
 * @returns {Promise<void>}
 */
async function clearLimit(identifier, type) {
  try {
    const db = await getDb();
    await db.collection(COLLECTION).deleteOne({ identifier, type });
  } catch (error) {
    console.error('[RATE_LIMIT] failed to clear counter:', error.message);
  }
}

module.exports = { consumeRateLimit, isWithinLimit, recordFailure, clearLimit };
