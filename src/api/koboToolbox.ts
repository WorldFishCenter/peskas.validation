import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiConfig';

// Get the appropriate API base URL based on environment
const API_BASE_URL = getApiBaseUrl();

/**
 * Generate an edit URL for a KoboToolbox submission
 * @returns The edit URL if successful, or throws an error with a user-friendly message
 */
export const generateEditUrl = async (submissionId: string, assetId?: string): Promise<string> => {
  try {
    const url = assetId
      ? `${API_BASE_URL}/kobo/edit-url/${submissionId}?asset_id=${assetId}`
      : `${API_BASE_URL}/kobo/edit-url/${submissionId}`;

    const response = await axios.get(url);

    if (response.status === 200 && response.data.url) {
      return response.data.url;
    }
    throw new Error('The server did not return a valid edit URL. Please try again or contact support.');
  } catch (error) {
    console.error("Failed to get edit URL:", error);
    
    // Extract user-friendly error message
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const errorData = error.response?.data;
      
      // Handle different error scenarios
      if (status === 503) {
        // Service unavailable (network/DNS issues)
        const message = errorData?.error || error.message;
        if (message.includes('Cannot resolve domain') || message.includes('unreachable')) {
          throw new Error('Cannot connect to the survey server. The server may be unreachable or require VPN access. Please contact your administrator.');
        }
        throw new Error(errorData?.error || 'The survey server is currently unavailable. Please try again later.');
      }
      
      if (status === 404) {
        throw new Error('Submission not found. The submission may have been deleted or the ID is incorrect.');
      }
      
      if (status === 401 || status === 403) {
        throw new Error('You do not have permission to access this submission. Please contact your administrator.');
      }
      
      if (status === 500) {
        const errorMessage = errorData?.error || errorData?.message || 'An internal server error occurred.';
        throw new Error(errorMessage);
      }
      
      // Generic error message
      const errorMessage = errorData?.error || errorData?.message || error.message || 'Failed to generate edit URL. Please try again.';
      throw new Error(errorMessage);
    }
    
    // Non-Axios errors
    throw new Error(error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.');
  }
};

/**
 * Update the validation status for a submission
 *
 * This function updates both MongoDB and KoboToolbox to keep them in sync
 * MongoDB is updated first so the table reflects changes immediately
 */
export const updateValidationStatus = async (
  submissionId: string,
  status: string,
  assetId?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    // Step 1: Update MongoDB first (so table reflects changes immediately)
    const mongoResponse = await axios.patch(`${API_BASE_URL}/submissions/${submissionId}/validation-status`, {
      validation_status: status,
      asset_id: assetId
    });

    if (!mongoResponse.data.success) {
      throw new Error(mongoResponse.data.message || 'Failed to update MongoDB');
    }

    // Step 2: Update KoboToolbox (must succeed to keep systems in sync)
    const koboResponse = await axios.patch(`${API_BASE_URL}/kobo/validation-status/${submissionId}`, {
      validation_status: status,
      asset_id: assetId
    });

    if (!koboResponse.data.success) {
      throw new Error(koboResponse.data.message || 'Failed to update KoboToolbox');
    }

    return { success: true, message: mongoResponse.data.message || 'Status updated successfully' };
  } catch (error) {
    console.error('Failed to update status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, message: `Failed to update: ${errorMessage}` };
  }
}; 