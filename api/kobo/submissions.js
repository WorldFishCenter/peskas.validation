import axios from 'axios';

export default async function handler(req, res) {
  try {
    // Get environment variables using process.env
    const koboApiUrl = process.env.KOBO_API_URL;
    const koboApiToken = process.env.KOBO_API_TOKEN;
    const koboAssetId = process.env.KOBO_ASSET_ID;
    
    console.log('API URL:', koboApiUrl);
    console.log('Token available:', !!koboApiToken);
    console.log('Asset ID:', koboAssetId);
    
    // Check if token exists
    if (!koboApiToken) {
      return res.status(500).json({ 
        error: 'Missing API token',
        message: 'The KoboToolbox API token is not available in the environment'
      });
    }
    
    const apiUrl = `${koboApiUrl}/assets/${koboAssetId}/data`;
    console.log('Attempting to call:', apiUrl);
    
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Token ${process.env.KOBO_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response received with status:', response.status);
    res.status(200).json({ results: response.data.results || response.data });
  } catch (error) {
    console.error('Detailed error info:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch submissions',
      details: error.message,
      responseInfo: error.response?.data
    });
  }
} 