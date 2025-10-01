import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiConfig';

// Get the appropriate API base URL based on environment
const API_BASE_URL = getApiBaseUrl();

/**
 * Generate an edit URL for a KoboToolbox submission
 */
export const generateEditUrl = async (submissionId: string, assetId?: string): Promise<string | null> => {
  try {
    const url = assetId
      ? `${API_BASE_URL}/kobo/edit_url/${submissionId}?asset_id=${assetId}`
      : `${API_BASE_URL}/kobo/edit_url/${submissionId}`;

    const response = await axios.get(url);

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
 */
export const updateValidationStatus = async (
  submissionId: string,
  status: string,
  assetId?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await axios.patch(`${API_BASE_URL}/kobo/validation_status/${submissionId}`, {
      validation_status: status,
      asset_id: assetId
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