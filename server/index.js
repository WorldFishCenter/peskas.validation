const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

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
    db = client.db('zanzibar-dev');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Get all submissions
app.get('/api/submissions', async (req, res) => {
  try {
    const submissions = await db.collection('surveys_flags').find({}).toArray();
    console.log("Raw MongoDB data:", submissions.slice(0, 3)); // Log first few entries
    
    // Filter out the metadata object and transform data
    const transformedData = submissions
      .filter(doc => doc.submission_id) // Skip metadata object without submission_id
      .map(doc => {
        // Format the date for better display
        const submissionDate = doc.submission_date 
          ? new Date(doc.submission_date).toISOString().split('T')[0] 
          : '';
        
        // Handle alert flag carefully with more logging
        let alertFlag = '';
        if (doc.alert_flag !== undefined) {
          // Check different cases of alert_flag format
          alertFlag = typeof doc.alert_flag === 'string'
            ? doc.alert_flag.replace(/"/g, '').trim()
            : String(doc.alert_flag);
        }
        
        // Calculate alert flags array for tooltip
        const alertFlags = alertFlag 
          ? alertFlag.split(',').map(flag => flag.trim()).filter(Boolean)
          : [];
        
        const result = {
          submission_id: doc.submission_id || '',
          submission_date: submissionDate,
          alert_flag: alertFlag,
          alert_flags: alertFlags,
          validation_status: doc.validation_status || 'validation_status_on_hold',
          validated_at: doc.validated_at 
            ? new Date(doc.validated_at).toISOString() 
            : doc.submission_date 
              ? new Date(doc.submission_date).toISOString() 
              : new Date().toISOString()
        };
        
        // Log processed entry for ones with alert flags
        if (alertFlag) {
          console.log("Processed entry with alert:", {
            submission_id: result.submission_id,
            alert_flag: result.alert_flag,
            alert_flags: result.alert_flags
          });
        }
        
        return result;
      });
    
    console.log("Sending transformed data count:", transformedData.length);
    res.json(transformedData);
  } catch (error) {
    console.error('Error fetching submissions:', error);
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

// Auth endpoint (simplified for demo)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'password') {
    res.status(200).json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

// Start server after connecting to MongoDB
connectToMongo().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}); 