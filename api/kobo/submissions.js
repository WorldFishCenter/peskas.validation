import axios from 'axios';

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
    
    const apiUrl = `${koboApiUrl}/assets/${koboAssetId}/data`;
    
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Token ${koboApiToken}`
      }
    });
    
    res.status(200).json({ results: response.data.results || response.data });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch submissions',
      details: error.message,
      responseInfo: error.response?.data,
      envVars: envVars
    });
  }
} 