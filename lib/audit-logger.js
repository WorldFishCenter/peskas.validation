/**
 * Audit logger utility.
 * Inserts audit events into the `users_audit` MongoDB collection.
 * All calls are fire-and-forget — errors are swallowed so they never
 * affect the main request/response flow.
 */

/**
 * Log a user action to the audit collection.
 *
 * @param {import('mongodb').Db} db
 * @param {object} event
 * @param {string|null}  event.user_id       - MongoDB _id of the user (null for failed logins)
 * @param {string}       event.username      - username (denormalized for easy querying)
 * @param {'auth'|'validation'|'download'} event.category
 * @param {string}       event.action        - one of the defined action constants
 * @param {'success'|'failure'} event.status
 * @param {object}       [event.details]     - action-specific payload
 * @param {import('http').IncomingMessage} [event.req] - Express request (used to extract IP / UA)
 */
async function logAuditEvent(db, event) {
  try {
    const { user_id, username, category, action, status, details = {}, req } = event;

    const ip = req
      ? ((req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || req.connection?.remoteAddress || null)
      : null;

    const user_agent = req ? (req.headers['user-agent'] || null) : null;

    await db.collection('users_audit').insertOne({
      timestamp: new Date(),
      user_id: user_id || null,
      username: username || null,
      category,
      action,
      status,
      details,
      ip,
      user_agent,
    });
  } catch (_err) {
    // Intentionally ignored — audit failures must never crash the main request
  }
}

/**
 * Ensure indexes exist on the `users_audit` collection.
 * Call once at server startup.
 *
 * @param {import('mongodb').Db} db
 */
async function ensureAuditIndexes(db) {
  try {
    const col = db.collection('users_audit');
    await col.createIndex({ timestamp: -1 });
    await col.createIndex({ username: 1, timestamp: -1 });
    await col.createIndex({ category: 1, timestamp: -1 });
  } catch (_err) {
    // Non-fatal
  }
}

module.exports = { logAuditEvent, ensureAuditIndexes };
