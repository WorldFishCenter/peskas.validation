const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

// Load .env file from parent directory
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;

let db;

// Function to get the MongoDB database connection
const getDb = () => db;

// Connect to MongoDB
async function connectToMongo() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db('zanzibar-prod');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Rename the endpoint back to match the client's expectation
app.get('/api/kobo/submissions', async (req, res) => {
  try {
    const koboAssetId = process.env.KOBO_ASSET_ID;
    const koboAssetIdV2 = process.env.KOBO_ASSET_ID_V2;
    const koboToken = process.env.KOBO_API_TOKEN;

    // 1. Fetch submissions from both KoboToolbox assets
    const koboUrl1 = `https://eu.kobotoolbox.org/api/v2/assets/${koboAssetId}/data/`;
    const koboUrl2 = `https://eu.kobotoolbox.org/api/v2/assets/${koboAssetIdV2}/data/`;

    const [koboResponse1, koboResponse2] = await Promise.all([
      axios.get(koboUrl1, {
        headers: {
          Authorization: `Token ${koboToken}`
        }
      }),
      axios.get(koboUrl2, {
        headers: {
          Authorization: `Token ${koboToken}`
        }
      })
    ]);

    // 2. Fetch alert flags from MongoDB
    const mongoSubmissions = await db.collection('surveys_flags')
      .find({})
      .toArray();

    // 3. Create a map of MongoDB data for easier lookup
    const mongoDataMap = new Map(
      mongoSubmissions.map(doc => [doc.submission_id, doc])
    );

    // 4. Combine the data from both assets, adding asset_id to track source
    const processSubmissions = (koboItems, assetId) => {
      return koboItems.map(koboItem => {
        const mongoData = mongoDataMap.get(koboItem._id);

        return {
          submission_id: koboItem._id,
          submission_date: koboItem._submission_time,
          vessel_number: koboItem.vessel_number || '',
          catch_number: koboItem.catch_number || '',
          submitted_by: koboItem.submitted_by || koboItem._submitted_by || '',
          validation_status: koboItem._validation_status?.validation_status?.uid ||
                           koboItem._validation_status?.uid ||
                           'validation_status_on_hold',
          validated_at: koboItem._validation_status?.timestamp || koboItem._submission_time,
          alert_flag: mongoData?.alert_flag || '',
          alert_flags: mongoData?.alert_flag ? [mongoData.alert_flag] : [],
          asset_id: assetId
        };
      });
    };

    const combinedData1 = processSubmissions(koboResponse1.data.results, koboAssetId);
    const combinedData2 = processSubmissions(koboResponse2.data.results, koboAssetIdV2);
    const allSubmissions = [...combinedData1, ...combinedData2];

    res.json({
      count: koboResponse1.data.count + koboResponse2.data.count,
      next: null,
      previous: null,
      results: allSubmissions
    });
  } catch (error) {
    console.error('Error fetching combined data:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Update validation status
app.patch('/api/submissions/:id/validation_status', async (req, res) => {
  try {
    const { id } = req.params;
    const { validation_status } = req.body;
    
    await db.collection('surveys_flags').updateOne(
      { submission_id: id },
      { 
        $set: { 
          validation_status,
          validated_at: new Date()
        } 
      }
    );
    
    res.json({ success: true, message: `Validation status correctly updated for submission ${id}` });
  } catch (error) {
    console.error('Error updating validation status:', error);
    res.status(500).json({ error: 'Failed to update validation status' });
  }
});

// Auth endpoint using environment variables
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;
  
  if (!validUsername || !validPassword) {
    console.error('Authentication credentials not properly configured in environment variables');
    return res.status(500).json({ success: false, error: 'Server authentication not configured' });
  }
  
  if (username === validUsername && password === validPassword) {
    res.status(200).json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

// Proxy route for getting edit URL
app.get('/api/kobo/edit_url/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { asset_id } = req.query;
    const koboAssetId = asset_id || process.env.KOBO_ASSET_ID;
    const koboToken = process.env.KOBO_API_TOKEN;

    const url = `https://eu.kobotoolbox.org/api/v2/assets/${koboAssetId}/data/${id}/enketo/edit/?return_url=false`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Token ${koboToken}`
      }
    });

    res.json({ url: response.data.url });
  } catch (error) {
    console.error('Error generating edit URL:', error);
    res.status(500).json({ error: 'Failed to generate edit URL' });
  }
});

// Proxy route for updating validation status
app.patch('/api/kobo/validation_status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { validation_status, asset_id } = req.body;
    const koboAssetId = asset_id || process.env.KOBO_ASSET_ID;
    const koboToken = process.env.KOBO_API_TOKEN;

    const url = `https://eu.kobotoolbox.org/api/v2/assets/${koboAssetId}/data/${id}/validation_status/`;

    // Create form data
    const formData = new URLSearchParams();
    formData.append('validation_status.uid', validation_status);

    const response = await axios.patch(url, formData.toString(), {
      headers: {
        Authorization: `Token ${koboToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    res.json({
      success: true,
      message: `Validation status correctly updated for submission ${id}`
    });
  } catch (error) {
    console.error('Error updating validation status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update validation status',
      message: `An error occurred: ${error.message}`
    });
  }
});

// Add this endpoint to collect enumerator statistics
app.get('/api/enumerator-stats', async (req, res) => {
  try {
    const koboAssetId = process.env.KOBO_ASSET_ID;
    const koboAssetIdV2 = process.env.KOBO_ASSET_ID_V2;
    const koboToken = process.env.KOBO_API_TOKEN;

    // Fetch submissions from both KoboToolbox assets
    const koboUrl1 = `https://eu.kobotoolbox.org/api/v2/assets/${koboAssetId}/data/`;
    const koboUrl2 = `https://eu.kobotoolbox.org/api/v2/assets/${koboAssetIdV2}/data/`;

    const [koboResponse1, koboResponse2] = await Promise.all([
      axios.get(koboUrl1, {
        headers: {
          Authorization: `Token ${koboToken}`
        }
      }),
      axios.get(koboUrl2, {
        headers: {
          Authorization: `Token ${koboToken}`
        }
      })
    ]);

    const submissions = [...koboResponse1.data.results, ...koboResponse2.data.results];
    
    // Group by enumerator
    const enumeratorStats = {};
    
    submissions.forEach(submission => {
      const enumerator = submission.submitted_by || submission._submitted_by || 'Unknown';
      
      if (!enumeratorStats[enumerator]) {
        enumeratorStats[enumerator] = {
          totalSubmissions: 0,
          submissionsWithAlerts: 0,
          alertFrequency: {},
          submissionsByDate: {},
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
      if (submission.alert_flag && submission.alert_flag.trim() !== '') {
        enumeratorStats[enumerator].submissionsWithAlerts++;
        
        // Count each alert type
        const alerts = submission.alert_flag.split(' ');
        alerts.forEach(alert => {
          if (!enumeratorStats[enumerator].alertFrequency[alert]) {
            enumeratorStats[enumerator].alertFrequency[alert] = 0;
          }
          enumeratorStats[enumerator].alertFrequency[alert]++;
        });
      }
      
      // Track submissions by date (for frequency chart)
      const submissionDate = submission._submission_time.split('T')[0]; // Get just the date part
      if (!enumeratorStats[enumerator].submissionsByDate[submissionDate]) {
        enumeratorStats[enumerator].submissionsByDate[submissionDate] = 0;
      }
      enumeratorStats[enumerator].submissionsByDate[submissionDate]++;
      
      // Count validation statuses
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
    
    // Calculate error percentages and create formatted response
    const formattedStats = Object.entries(enumeratorStats).map(([name, stats]) => {
      return {
        name,
        totalSubmissions: stats.totalSubmissions,
        submissionsWithAlerts: stats.submissionsWithAlerts,
        errorRate: (stats.submissionsWithAlerts / stats.totalSubmissions) * 100,
        alertFrequency: Object.entries(stats.alertFrequency).map(([code, count]) => {
          const ALERT_FLAG_DESCRIPTIONS = {
            '1': 'A catch was reported, but no taxon was specified',
            '2': 'A taxon was specified, but no information was provided about the number of fish, their size, or their weight',
            '3': 'Length is smaller than minimum length treshold for the selected catch taxon',
            '4': 'Length exceeds maximum length treshold for the selected catch taxon',
            '5': 'Bucket weight exceeds maximum (50kg)',
            '6': 'Number of buckets exceeds maximum (300)',
            '7': 'Number of individuals exceeds maximum (100)',
            '8': 'Price per kg exceeds 81420 TZS',
            '9': 'Catch per unit effort exceeds maximum (30kg per hour per fisher)',
            '10': 'Revenue per unit effort exceeds maximum (81420 TZS per hour per fisher)'
          };
          return {
            code,
            count,
            description: ALERT_FLAG_DESCRIPTIONS[code] || 'Unknown alert'
          };
        }).sort((a, b) => b.count - a.count),
        submissionTrend: Object.entries(stats.submissionsByDate)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => new Date(a.date) - new Date(b.date)),
        validationStatus: stats.validationStatus
      };
    }).sort((a, b) => b.totalSubmissions - a.totalSubmissions);
    
    res.json(formattedStats);
  } catch (error) {
    console.error('Error fetching enumerator statistics:', error);
    res.status(500).json({ error: 'Failed to fetch enumerator statistics' });
  }
});

// Endpoint to fetch data from the enumerators_stats collection
app.get('/api/enumerators-stats', async (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database connection not established' });
    }

    const stats = await db.collection('enumerators_stats').find({}).toArray();
    console.log(`Fetched ${stats.length} enumerator stats records from MongoDB`);
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching enumerator statistics:', error);
    res.status(500).json({ error: 'Failed to fetch enumerator statistics' });
  }
});

// Admin endpoint to manually refresh enumerator stats
app.post('/api/admin/refresh-enumerator-stats', async (req, res) => {
  try {
    // Validate admin token
    const adminToken = req.headers['admin-token'];
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
    }
    
    const db = getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database connection not established' });
    }
    
    // Here we would typically implement the data migration logic
    // For this example, we'll just fetch the data from Kobo and MongoDB and rebuild the stats
    const koboAssetId = process.env.KOBO_ASSET_ID;
    const koboAssetIdV2 = process.env.KOBO_ASSET_ID_V2;
    const koboToken = process.env.KOBO_API_TOKEN;

    if (!koboAssetId || !koboAssetIdV2 || !koboToken) {
      return res.status(500).json({ error: 'Missing KoboToolbox configuration' });
    }

    // 1. Fetch submissions from both KoboToolbox assets
    const koboUrl1 = `https://eu.kobotoolbox.org/api/v2/assets/${koboAssetId}/data/`;
    const koboUrl2 = `https://eu.kobotoolbox.org/api/v2/assets/${koboAssetIdV2}/data/`;

    const [koboResponse1, koboResponse2] = await Promise.all([
      axios.get(koboUrl1, {
        headers: {
          Authorization: `Token ${koboToken}`
        }
      }),
      axios.get(koboUrl2, {
        headers: {
          Authorization: `Token ${koboToken}`
        }
      })
    ]);

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

    const allSubmissions = [...koboResponse1.data.results, ...koboResponse2.data.results];
    allSubmissions.forEach(submission => {
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
    
    res.json({ 
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
});

// Start server after connecting to MongoDB
connectToMongo().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}); 