import axios from 'axios';
import { MongoClient } from 'mongodb';

// Cache the database connection
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('zanzibar-dev');
  
  cachedDb = db;
  return db;
}

export default async function handler(req, res) {
  // Debug all environment variables (without revealing values)
  const envVars = Object.keys(process.env).filter(key => key.includes('KOBO'));
  console.log('Available environment variables:', envVars);
  
  try {
    // Direct access check
    console.log('Direct KOBO_API_TOKEN check:', typeof process.env.KOBO_API_TOKEN);
    console.log('Direct KOBO_API_URL check:', typeof process.env.KOBO_API_URL);
    
    // Get environment variables using process.env
    const koboApiUrl = process.env.KOBO_API_URL;
    const koboApiToken = process.env.KOBO_API_TOKEN;
    const koboAssetId = process.env.KOBO_ASSET_ID;
    
    // Use static test data if environment variables are missing (for debugging)
    if (!koboApiToken) {
      return res.status(500).json({ 
        error: 'Environment Variable Issue',
        message: 'KOBO_API_TOKEN is not available in the environment',
        envVars: envVars,
        availableVars: Object.keys(process.env).length
      });
    }
    
    // 1. Fetch KoboToolbox data
    const apiUrl = `${koboApiUrl}/assets/${koboAssetId}/data`;
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Token ${koboApiToken}`
      }
    });
    
    // 2. Connect to MongoDB and fetch alert flags
    const db = await connectToDatabase();
    const mongoSubmissions = await db.collection('surveys_flags')
      .find({})
      .toArray();
      
    // 3. Create a map of MongoDB data for easier lookup
    const mongoDataMap = new Map(
      mongoSubmissions.map(doc => [doc.submission_id, doc])
    );
    
    // 4. Combine the data
    const combinedData = response.data.results.map(koboItem => {
      const mongoData = mongoDataMap.get(koboItem._id);
      
      return {
        submission_id: koboItem._id,
        submission_date: koboItem._submission_time,
        vessel_number: koboItem.vessel_number || '',
        catch_number: koboItem.catch_number || '',
        validation_status: koboItem._validation_status?.validation_status?.uid || 
                         koboItem._validation_status?.uid || 
                         'validation_status_on_hold',
        validated_at: koboItem._validation_status?.timestamp || koboItem._submission_time,
        alert_flag: mongoData?.alert_flag || '',
        alert_flags: mongoData?.alert_flag ? [mongoData.alert_flag] : []
      };
    });
    
    // Return the combined data
    res.status(200).json({
      count: response.data.count,
      next: response.data.next,
      previous: response.data.previous,
      results: combinedData
    });
  } catch (error) {
    console.error('Error fetching data:', {
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch submissions',
      details: error.message,
      responseInfo: error.response?.data,
      envVars: envVars
    });
  }
} 