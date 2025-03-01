import axios from 'axios';

// This should point to your actual KoboToolbox API
const KOBO_API_URL = process.env.KOBO_API_URL;
const KOBO_API_TOKEN = process.env.KOBO_API_TOKEN;

export default async function handler(req, res) {
  try {
    // Log environment variables (without exposing sensitive tokens fully)
    console.log('API URL:', process.env.KOBO_API_URL);
    console.log('Token available:', !!process.env.KOBO_API_TOKEN);
    console.log('Asset ID:', process.env.KOBO_ASSET_ID);
    
    // Make sure we're accessing the correct endpoint for KoboToolbox
    // KoboToolbox endpoint structure is likely different from what we're using
    // Most KoboToolbox APIs use: /assets/{asset_id}/data
    const apiUrl = `${process.env.KOBO_API_URL}/assets/${process.env.KOBO_ASSET_ID}/data`;
    console.log('Attempting to call:', apiUrl);
    
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Token ${process.env.KOBO_API_TOKEN}`
      }
    });
    
    console.log('Response received with status:', response.status);
    console.log('Response data structure:', Object.keys(response.data));
    
    // Make sure we're returning the expected structure
    // KoboToolbox typically returns results directly, not in a 'results' property
    res.status(200).json({ results: response.data.results || response.data });
  } catch (error) {
    console.error('Detailed error info:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      endpoint: `${process.env.KOBO_API_URL}/assets/${process.env.KOBO_ASSET_ID}/data`
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch submissions',
      details: error.message,
      responseInfo: error.response?.data
    });
  }
} 