const { MongoClient } = require('mongodb');

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get database credentials from environment variables
    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      return res.status(500).json({ error: 'Missing MongoDB connection string' });
    }

    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('zanzibar-prod');
    const stats = await db.collection('enumerators_stats').find({}).toArray();
    
    console.log(`Fetched ${stats.length} enumerator stats records from MongoDB`);
    
    await client.close();
    
    return res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching enumerator statistics:', error);
    return res.status(500).json({ error: 'Failed to fetch enumerator statistics' });
  }
} 