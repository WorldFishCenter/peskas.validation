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
    
    // Transform the data to match what your frontend expects
    // This mirrors the transformation in server/index.js
    const transformedResults = response.data.results.map(koboItem => {
      return {
        submission_id: koboItem._id,
        submission_date: koboItem._submission_time,
        vessel_number: koboItem.vessel_number || '',
        catch_number: koboItem.catch_number || '',
        validation_status: koboItem._validation_status?.validation_status?.uid || 
                           koboItem._validation_status?.uid || 
                           'validation_status_on_hold',
        validated_at: koboItem._validation_status?.timestamp || koboItem._submission_time,
        alert_flag: '', // MongoDB data not available in serverless
        alert_flags: [] // MongoDB data not available in serverless
      };
    });
    
    // Return the transformed data in the expected format
    res.status(200).json({
      count: response.data.count,
      next: response.data.next,
      previous: response.data.previous,
      results: transformedResults
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch submissions',
      details: error.message,
      responseInfo: error.response?.data,
      envVars: envVars
    });
  }
} 