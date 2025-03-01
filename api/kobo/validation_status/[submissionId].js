import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { submissionId } = req.query;
  const { validation_status } = req.body;
  
  try {
    // Get environment variables using consistent naming
    const koboApiUrl = process.env.KOBO_API_URL;
    const koboApiToken = process.env.KOBO_API_TOKEN;
    const koboAssetId = process.env.KOBO_ASSET_ID;
    
    // Verify environment variables are available
    if (!koboApiToken || !koboApiUrl || !koboAssetId) {
      console.error('Missing environment variables for KoboToolbox API');
      return res.status(500).json({
        success: false,
        error: 'Configuration error',
        message: 'Missing required environment variables'
      });
    }
    
    // Make the request exactly like the local version
    await axios.patch(
      `${koboApiUrl}/assets/${koboAssetId}/data/${submissionId}`,
      { validation_status },  // Keep the same JSON format
      {
        headers: {
          'Authorization': `Token ${koboApiToken}`,
          'Content-Type': 'application/json'  // Keep as JSON
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
    console.error('Error details:', {
      message: error.message,
      responseData: error.response?.data
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to update validation status',
      message: error.message
    });
  }
} 