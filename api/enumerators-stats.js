import { MongoClient } from 'mongodb';

// Establish a new connection for each serverless function invocation
const connectToMongo = async () => {
  try {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    console.log('Connected to MongoDB in serverless function');
    return client.db('zanzibar-prod');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = await connectToMongo();
    const stats = await db.collection('enumerators_stats').find({}).toArray();
    console.log(`Fetched ${stats.length} enumerator stats records from MongoDB`);
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    // Return the data
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching enumerator statistics:', error);
    res.status(500).json({ error: 'Failed to fetch enumerator statistics' });
  }
} 