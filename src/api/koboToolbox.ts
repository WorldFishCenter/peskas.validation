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
  status: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await axios.patch(`${API_BASE_URL}/validation_status/${submissionId}`, {
      validation_status: status
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || `Error ${response.status}: ${response.statusText}`);
    }
    
    return { success: true, message: response.data.message || 'Status updated successfully' };
  } catch (error) {
    console.error('Failed to update status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, message: `Failed to update: ${errorMessage}` };
  }
}; 