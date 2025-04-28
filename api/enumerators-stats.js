import { MongoClient } from 'mongodb';

// Cache the database connection
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('zanzibar-prod');
  
  cachedDb = db;
  return db;
}

export default async function handler(req, res) {
  try {
    // Connect to MongoDB
    const db = await connectToDatabase();
    
    // Fetch enumerator stats from the collection
    const stats = await db.collection('enumerators_stats')
      .find({})
      .toArray();
    
    console.log(`Fetched ${stats.length} enumerator stats records from MongoDB`);
    
    // Return the data
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching enumerator statistics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch enumerator statistics',
      details: error.message
    });
  }
}
