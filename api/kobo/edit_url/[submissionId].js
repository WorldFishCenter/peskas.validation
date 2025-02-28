import axios from 'axios';

// Get KoboToolbox credentials from environment variables
const KOBO_API_URL = process.env.KOBO_API_URL;
const KOBO_API_TOKEN = process.env.KOBO_API_TOKEN;

export default async function handler(req, res) {
  const { submissionId } = req.query;
  
  try {
    // Make the actual request to KoboToolbox API
    const response = await axios.get(
      `${KOBO_API_URL}/assets/${process.env.KOBO_ASSET_ID}/data/${submissionId}/edit`,
      {
        headers: {
          'Authorization': `Token ${KOBO_API_TOKEN}`
        }
      }
    );
    
    // Return the edit URL
    res.status(200).json({ url: response.data.url });
  } catch (error) {
    console.error('Error generating edit URL:', error);
    res.status(500).json({ 
      error: 'Failed to generate edit URL',
      message: error.message 
    });
  }
} 