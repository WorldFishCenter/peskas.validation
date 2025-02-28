import axios from 'axios';

// This should point to your actual KoboToolbox API
const KOBO_API_URL = process.env.KOBO_API_URL;
const KOBO_API_TOKEN = process.env.KOBO_API_TOKEN;

export default async function handler(req, res) {
  try {
    // Make the actual request to KoboToolbox
    const response = await axios.get(`${KOBO_API_URL}/submissions`, {
      headers: {
        'Authorization': `Token ${KOBO_API_TOKEN}`
      }
    });
    
    // Process the response the same way your Express server does
    res.status(200).json({ results: response.data.results });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
} 