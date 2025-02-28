import axios from 'axios';

// Get KoboToolbox credentials from environment variables
const KOBO_API_URL = process.env.KOBO_API_URL;
const KOBO_API_TOKEN = process.env.KOBO_API_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { submissionId } = req.query;
  const { validation_status } = req.body;
  
  try {
    // Make the actual request to KoboToolbox API
    await axios.patch(
      `${KOBO_API_URL}/assets/${process.env.KOBO_ASSET_ID}/data/${submissionId}`,
      { validation_status },
      {
        headers: {
          'Authorization': `Token ${KOBO_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Return success response
    res.status(200).json({
      success: true,
      message: `Validation status correctly updated for submission ${submissionId}`
    });
  } catch (error) {
    console.error('Error updating validation status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update validation status',
      message: error.message
    });
  }
} 