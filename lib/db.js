/**
 * MongoDB Connection Singleton for Vercel Serverless Functions
 *
 * This module provides a cached MongoDB connection that persists across
 * warm serverless function invocations, reducing connection overhead.
 */

const { MongoClient } = require('mongodb');
const { ensureAuditIndexes } = require('./audit-logger');

// Global connection cache (survives across warm invocations)
let cachedDb = null;
let cachedClient = null;

/**
 * Connect to MongoDB with connection caching for serverless environments
 *
 * @returns {Promise<{db: import('mongodb').Db, client: MongoClient}>} database and client
 */
async function connectToDatabase() {
  // Return the cached connection straight away.
  //
  // This used to run `cachedClient.topology.isConnected()` plus an `admin().ping()` on every
  // call — a full extra round-trip to Atlas ahead of every single API request, on a driver that
  // already monitors topology in the background and retries reads and writes on a dropped
  // connection (`retryReads`/`retryWrites` below). The health check bought nothing the driver
  // does not already do, and `topology` is an internal the driver does not guarantee.
  if (cachedDb && cachedClient) {
    return { db: cachedDb, client: cachedClient };
  }

  // Validate environment variables
  const uri = process.env.MONGODB_VALIDATION_URI;
  const dbName = process.env.MONGODB_VALIDATION_DB;

  if (!uri) {
    throw new Error('MONGODB_VALIDATION_URI environment variable is not set');
  }

  if (!dbName) {
    throw new Error('MONGODB_VALIDATION_DB environment variable is not set. Please set it in your .env file.');
  }

  try {
    // Create new connection with robust settings
    const client = new MongoClient(uri, {
      maxPoolSize: 10, // Connection pool size
      minPoolSize: 2,
      maxIdleTimeMS: 60000, // Close idle connections after 60s
      serverSelectionTimeoutMS: 10000, // Timeout after 10s if can't connect
      socketTimeoutMS: 45000, // Socket timeout (45s)
      connectTimeoutMS: 10000, // Initial connection timeout (10s)
      retryWrites: true, // Enable retryable writes
      retryReads: true, // Enable retryable reads
      w: 'majority', // Write concern: wait for majority acknowledgement
    });

    await client.connect();
    const db = client.db(dbName);

    // Verify connection with ping
    await db.admin().ping();

    // Cache the connection
    cachedDb = db;
    cachedClient = client;

    // Audit indexes are declared once, in lib/audit-logger.js. They were previously inlined
    // here as a near-duplicate set (this copy had a 90-day TTL the other lacked), so retention
    // depended on which path ran first. Kept non-blocking: production has no startup hook, so
    // a cold connection is the only chance to create them.
    ensureAuditIndexes(db).catch(() => {});

    console.log(`✓ Connected to MongoDB: ${dbName}`);

    return { db, client };
  } catch (error) {
    console.error('MongoDB connection error:', error);

    // Provide helpful error messages
    // `cause` keeps the driver's original error (and its stack) reachable — the friendlier
    // message is for the operator, not a replacement for the diagnosis.
    if (error.message.includes('authentication')) {
      throw new Error('MongoDB authentication failed. Check MONGODB_VALIDATION_URI credentials.', { cause: error });
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      throw new Error('MongoDB server not reachable. Check network connection and MONGODB_VALIDATION_URI.', { cause: error });
    } else if (error.message.includes('timeout')) {
      throw new Error('MongoDB connection timeout. Server may be overloaded or unreachable.', { cause: error });
    }

    throw error;
  }
}

/**
 * Helper to get database instance (compatibility with existing code)
 *
 * @returns {Promise<import('mongodb').Db>} MongoDB database instance
 */
async function getDb() {
  const { db } = await connectToDatabase();
  return db;
}

module.exports = {
  connectToDatabase,
  getDb
};
