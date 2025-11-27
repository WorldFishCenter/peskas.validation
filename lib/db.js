/**
 * MongoDB Connection Singleton for Vercel Serverless Functions
 *
 * This module provides a cached MongoDB connection that persists across
 * warm serverless function invocations, reducing connection overhead.
 */

const { MongoClient } = require('mongodb');

// Global connection cache (survives across warm invocations)
let cachedDb = null;
let cachedClient = null;

/**
 * Connect to MongoDB with connection caching for serverless environments
 *
 * @returns {Promise<{db: Db, client: MongoClient}>} MongoDB database and client instances
 */
async function connectToDatabase() {
  // Return cached connection if available and healthy
  if (cachedDb && cachedClient) {
    try {
      // Check if connection is still alive using ping
      const isConnected = cachedClient.topology?.isConnected();

      if (isConnected) {
        // Additional health check: ping the database
        try {
          await cachedDb.admin().ping();
          return { db: cachedDb, client: cachedClient };
        } catch (pingError) {
          console.log('Database ping failed, connection unhealthy. Reconnecting...');
          // Close stale connection
          try {
            await cachedClient.close();
          } catch (closeError) {
            console.warn('Error closing stale connection:', closeError.message);
          }
          cachedDb = null;
          cachedClient = null;
        }
      } else {
        console.log('Cached connection is not active, reconnecting...');
        cachedDb = null;
        cachedClient = null;
      }
    } catch (error) {
      console.log('Error checking cached connection, reconnecting...', error.message);
      cachedDb = null;
      cachedClient = null;
    }
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

    console.log(`✓ Connected to MongoDB: ${dbName}`);

    return { db, client };
  } catch (error) {
    console.error('MongoDB connection error:', error);

    // Provide helpful error messages
    if (error.message.includes('authentication')) {
      throw new Error('MongoDB authentication failed. Check MONGODB_VALIDATION_URI credentials.');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      throw new Error('MongoDB server not reachable. Check network connection and MONGODB_VALIDATION_URI.');
    } else if (error.message.includes('timeout')) {
      throw new Error('MongoDB connection timeout. Server may be overloaded or unreachable.');
    }

    throw error;
  }
}

/**
 * Helper to get database instance (compatibility with existing code)
 *
 * @returns {Promise<Db>} MongoDB database instance
 */
async function getDb() {
  const { db } = await connectToDatabase();
  return db;
}

module.exports = {
  connectToDatabase,
  getDb
};
