import axios from 'axios';

// Get KoboToolbox credentials from environment variables
const KOBO_API_URL = process.env.KOBO_API_URL;
const KOBO_API_TOKEN = process.env.KOBO_API_TOKEN;

export default async function handler(req, res) {
  const { path } = req.query;
  const fullPath = Array.isArray(path) ? path.join('/') : path;
  
  try {
    // Forward the request to KoboToolbox with the same method, headers, and body
    const response = await axios({
      method: req.method,
      url: `${KOBO_API_URL}/${fullPath}`,
      headers: {
        ...req.headers,
        'Authorization': `Token ${KOBO_API_TOKEN}`,
        'host': new URL(KOBO_API_URL).host
      },
      data: req.body,
      validateStatus: () => true // Don't throw on non-2xx status codes
    });
    
    // Return the response with the same status code and body
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`Error proxying ${req.method} to ${fullPath}:`, error);
    res.status(500).json({ 
      error: 'API proxy error',
      message: error.message 
    });
  }
} 