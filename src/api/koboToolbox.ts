import axios from 'axios';

// Local server proxy configuration - avoids CORS issues
const API_BASE_URL = 'http://localhost:3001/api/kobo';

/**
 * Generate an edit URL for a KoboToolbox submission
 * Uses the server proxy to avoid CORS issues
 */
export const generateEditUrl = async (submissionId: string): Promise<string | null> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/edit_url/${submissionId}`);
    
    if (response.status === 200 && response.data.url) {
      return response.data.url;
    }
    return null;
  } catch (error) {
    console.error("Failed to get edit URL:", error);
    return null;
  }
};

/**
 * Update the validation status for a KoboToolbox submission
 * Uses the server proxy to avoid CORS issues
 */
export const updateValidationStatus = async (
  submissionId: string, 
  validationStatus: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await axios.patch(`${API_BASE_URL}/validation_status/${submissionId}`, {
      validation_status: validationStatus
    });
    
    return response.data;
  } catch (error: any) {
    console.error("Error updating validation status:", error);
    return { 
      success: false, 
      message: error.response?.data?.message || `An error occurred: ${error.message}` 
    };
  }
}; 