const { MongoClient } = require('mongodb');
const axios = require('axios');

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Admin-Token'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate admin token
    const adminToken = req.headers['admin-token'];
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
    }
    
    // Get database credentials from environment variables
    const MONGODB_URI = process.env.MONGODB_URI;
    const koboAssetId = process.env.KOBO_ASSET_ID;
    const koboToken = process.env.KOBO_API_TOKEN;
    
    if (!MONGODB_URI) {
      return res.status(500).json({ error: 'Missing MongoDB connection string' });
    }
    
    if (!koboAssetId || !koboToken) {
      return res.status(500).json({ error: 'Missing KoboToolbox configuration' });
    }

    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('zanzibar-prod');
    
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
    
    await client.close();
    
    return res.status(200).json({ 
      success: true, 
      message: `Successfully refreshed enumerator statistics. Processed ${formattedStats.length} enumerators.` 
    });
  } catch (error) {
    console.error('Error refreshing enumerator statistics:', error);
    return res.status(500).json({ 
      error: 'Failed to refresh enumerator statistics',
      message: error.message
    });
  }
} 