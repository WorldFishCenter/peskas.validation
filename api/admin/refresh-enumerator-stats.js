import { MongoClient } from 'mongodb';
import axios from 'axios';

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
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Admin-Token');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Validate admin token
    const adminToken = req.headers['admin-token'];
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
    }
    
    const db = await connectToMongo();
    
    // Here we would typically implement the data migration logic
    // For this example, we'll just fetch the data from Kobo and MongoDB and rebuild the stats
    const koboAssetId = process.env.KOBO_ASSET_ID;
    const koboToken = process.env.KOBO_API_TOKEN;
    
    if (!koboAssetId || !koboToken) {
      return res.status(500).json({ error: 'Missing KoboToolbox configuration' });
    }
    
    // 1. Fetch submissions from KoboToolbox
    const koboUrl = `https://eu.kobotoolbox.org/api/v2/assets/${koboAssetId}/data/`;
    const koboResponse = await axios.get(koboUrl, {
      headers: {
        Authorization: `Token ${koboToken}`
      }
    });

    // 2. Fetch alert flags from MongoDB
    const mongoSubmissions = await db.collection('surveys_flags')
      .find({})
      .toArray();

    // 3. Create a map of MongoDB data for easier lookup
    const mongoDataMap = new Map(
      mongoSubmissions.map(doc => [doc.submission_id, doc])
    );
    
    // 4. Group by enumerator
    const enumeratorStats = {};
    
    koboResponse.data.results.forEach(submission => {
      const enumerator = submission.submitted_by || submission._submitted_by || 'Unknown';
      const mongoData = mongoDataMap.get(submission._id);
      const alertFlag = mongoData?.alert_flag || '';
      
      if (!enumeratorStats[enumerator]) {
        enumeratorStats[enumerator] = {
          name: enumerator,
          submissions: [],
          totalSubmissions: 0,
          submissionsWithAlerts: 0,
          submissionTrend: {}
        };
      }
      
      // Add submission data
      enumeratorStats[enumerator].submissions.push({
        submission_id: submission._id,
        submitted_by: enumerator,
        submission_date: submission._submission_time,
        alert_flag: alertFlag
      });
      
      // Increment total submissions
      enumeratorStats[enumerator].totalSubmissions++;
      
      // Count submissions with alerts
      if (alertFlag && alertFlag.trim() !== '') {
        enumeratorStats[enumerator].submissionsWithAlerts++;
      }
      
      // Track submission trends by date
      const submissionDate = submission._submission_time.split('T')[0];
      if (!enumeratorStats[enumerator].submissionTrend[submissionDate]) {
        enumeratorStats[enumerator].submissionTrend[submissionDate] = 0;
      }
      enumeratorStats[enumerator].submissionTrend[submissionDate]++;
    });
    
    // 5. Calculate error rates and format the data
    const formattedStats = Object.values(enumeratorStats).map(stats => {
      // Calculate error rate
      const errorRate = stats.totalSubmissions > 0 
        ? (stats.submissionsWithAlerts / stats.totalSubmissions) * 100 
        : 0;
      
      // Format submission trend for the chart
      const submissionTrend = Object.entries(stats.submissionTrend)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      
      return {
        ...stats,
        errorRate,
        submissionTrend
      };
    });
    
    // 6. Replace the data in MongoDB
    await db.collection('enumerators_stats').deleteMany({});
    await db.collection('enumerators_stats').insertMany(formattedStats);
    
    res.status(200).json({ 
      success: true, 
      message: `Successfully refreshed enumerator statistics. Processed ${formattedStats.length} enumerators.` 
    });
  } catch (error) {
    console.error('Error refreshing enumerator statistics:', error);
    res.status(500).json({ 
      error: 'Failed to refresh enumerator statistics',
      message: error.message
    });
  }
} 