import { MongoClient } from 'mongodb';
import axios from 'axios';

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
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Validate admin token
    const adminToken = req.headers['admin-token'];
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
    }
    
    // Connect to MongoDB
    const db = await connectToDatabase();
    
    // Fetch submissions from KoboToolbox
    const koboAssetId = process.env.KOBO_ASSET_ID;
    const koboToken = process.env.KOBO_API_TOKEN;
    
    if (!koboAssetId || !koboToken) {
      return res.status(500).json({ error: 'Missing KoboToolbox configuration' });
    }
    
    // 1. Fetch submissions from KoboToolbox
    const koboUrl = `${process.env.KOBO_API_URL}/assets/${koboAssetId}/data`;
    const koboResponse = await axios.get(koboUrl, {
      headers: {
        'Authorization': `Token ${koboToken}`
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
      const submissionId = submission._id;
      const mongoData = mongoDataMap.get(submissionId);
      
      if (!enumeratorStats[enumerator]) {
        enumeratorStats[enumerator] = {
          name: enumerator,
          totalSubmissions: 0,
          submissionsWithAlerts: 0,
          alertFrequency: {},
          submissionTrend: {},
          validationStatus: {
            approved: 0,
            not_approved: 0,
            on_hold: 0
          }
        };
      }
      
      // Increment total submissions
      enumeratorStats[enumerator].totalSubmissions++;
      
      // Count submissions with alerts
      if (mongoData && mongoData.alert_flag && mongoData.alert_flag !== "NA") {
        enumeratorStats[enumerator].submissionsWithAlerts++;
        
        // Track alert frequency
        const alerts = mongoData.alert_flag.split(' ');
        alerts.forEach(alert => {
          if (!enumeratorStats[enumerator].alertFrequency[alert]) {
            enumeratorStats[enumerator].alertFrequency[alert] = 0;
          }
          enumeratorStats[enumerator].alertFrequency[alert]++;
        });
      }
      
      // Track submission dates
      const submissionDate = submission._submission_time.split('T')[0];
      if (!enumeratorStats[enumerator].submissionTrend[submissionDate]) {
        enumeratorStats[enumerator].submissionTrend[submissionDate] = 0;
      }
      enumeratorStats[enumerator].submissionTrend[submissionDate]++;
      
      // Track validation status
      const status = submission._validation_status?.validation_status?.uid || 
                   submission._validation_status?.uid || 
                   'validation_status_on_hold';
      
      if (status.includes('approved')) {
        enumeratorStats[enumerator].validationStatus.approved++;
      } else if (status.includes('not_approved')) {
        enumeratorStats[enumerator].validationStatus.not_approved++;
      } else {
        enumeratorStats[enumerator].validationStatus.on_hold++;
      }
    });
    
    // Convert to array and calculate error rates
    const statsList = Object.values(enumeratorStats).map(stats => {
      // Calculate error rate
      const errorRate = stats.totalSubmissions > 0 
        ? (stats.submissionsWithAlerts / stats.totalSubmissions) * 100 
        : 0;
      
      // Convert submission trend object to array format
      const submissionTrend = Object.entries(stats.submissionTrend).map(
        ([date, count]) => ({ date, count })
      ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Convert alert frequency to array format
      const alertFrequency = Object.entries(stats.alertFrequency).map(
        ([code, count]) => ({ code, count })
      ).sort((a, b) => b.count - a.count);
      
      return {
        ...stats,
        errorRate,
        submissionTrend,
        alertFrequency
      };
    });
    
    // 5. Clear the current collection and insert new data
    await db.collection('enumerators_stats').deleteMany({});
    if (statsList.length > 0) {
      await db.collection('enumerators_stats').insertMany(statsList);
    }
    
    res.status(200).json({
      success: true,
      message: `Successfully refreshed statistics for ${statsList.length} enumerators`,
      count: statsList.length
    });
  } catch (error) {
    console.error('Error refreshing enumerator statistics:', error);
    res.status(500).json({ 
      error: 'Failed to refresh enumerator statistics',
      details: error.message
    });
  }
}
