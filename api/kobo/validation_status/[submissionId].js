import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { submissionId } = req.query;
  const { validation_status } = req.body;
  
  console.log('Request info:', {
    method: req.method,
    submissionId,
    body: req.body,
    validation_status
  });
  
  try {
    // Log environment variables
    console.log('Environment variables available:', { 
      KOBO_API_URL: !!process.env.KOBO_API_URL,
      KOBO_API_TOKEN: !!process.env.KOBO_API_TOKEN,
      KOBO_ASSET_ID: !!process.env.KOBO_ASSET_ID
    });
    
    // Use the specific validation_status endpoint
    const url = `${process.env.KOBO_API_URL}/assets/${process.env.KOBO_ASSET_ID}/data/${submissionId}/validation_status/`;
    console.log('Request URL:', url);
    
    // Use form-urlencoded format with the expected parameter name
    const formData = new URLSearchParams();
    formData.append('validation_status.uid', validation_status);
    
    // Log the payload we're about to send
    console.log('Request payload:', { validation_status });
    
    // Make the exact same request that works locally
    const response = await axios.patch(
      url,
      formData.toString(),
      {
        headers: {
          'Authorization': `Token ${process.env.KOBO_API_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('Response received:', {
      status: response.status,
      data: response.data
    });
    
    res.status(200).json({
      success: true,
      message: `Validation status correctly updated for submission ${submissionId}`
    });
  } catch (error) {
    // Log the full error details without exposing sensitive info
    console.error('Error updating status:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to update validation status',
      message: error.message,
      details: error.response?.data
    });
  }
} 