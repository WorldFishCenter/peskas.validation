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
    const koboToken = process.env.KOBO_API_TOKEN;
    
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

    // 4. Combine the data
    const combinedData = koboResponse.data.results.map(koboItem => {
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
        alert_flags: mongoData?.alert_flag ? [mongoData.alert_flag] : []
      };
    });
    
    res.json({
      count: koboResponse.data.count,
      next: koboResponse.data.next,
      previous: koboResponse.data.previous,
      results: combinedData
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
    const koboAssetId = process.env.KOBO_ASSET_ID;
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
    const { validation_status } = req.body;
    const koboAssetId = process.env.KOBO_ASSET_ID;
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
    const koboToken = process.env.KOBO_API_TOKEN;
    
    // Fetch submissions from KoboToolbox
    const koboUrl = `https://eu.kobotoolbox.org/api/v2/assets/${koboAssetId}/data/`;
    const koboResponse = await axios.get(koboUrl, {
      headers: {
        Authorization: `Token ${koboToken}`
      }
    });

    const submissions = koboResponse.data.results;
    
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
        alertFrequency: Object.entries(stats.alertFrequency).map(([code, count]) => ({
          code,
          count,
          description: ALERT_FLAG_DESCRIPTIONS[code] || 'Unknown alert'
        })).sort((a, b) => b.count - a.count),
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

// Start server after connecting to MongoDB
connectToMongo().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}); 