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
      ? `${API_BASE_URL}/kobo/edit-url/${submissionId}?asset_id=${assetId}`
      : `${API_BASE_URL}/kobo/edit-url/${submissionId}`;

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
 * Update the validation status for a submission
 *
 * This function updates both MongoDB (primary) and KoboToolbox (optional sync)
 * according to the architecture: MongoDB is the single source of truth for the portal
 */
export const updateValidationStatus = async (
  submissionId: string,
  status: string,
  assetId?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    // Step 1: Update MongoDB first (primary update - this is what the table displays)
    const mongoResponse = await axios.patch(`${API_BASE_URL}/submissions/${submissionId}/validation_status`, {
      validation_status: status,
      asset_id: assetId
    });

    if (!mongoResponse.data.success) {
      throw new Error(mongoResponse.data.message || 'Failed to update MongoDB');
    }

    // Step 2: Optionally sync to KoboToolbox (best effort - don't fail if this fails)
    try {
      await axios.patch(`${API_BASE_URL}/kobo/validation-status/${submissionId}`, {
        validation_status: status,
        asset_id: assetId
      });
    } catch (koboError) {
      console.warn('Failed to sync validation status to KoboToolbox (MongoDB updated successfully):', koboError);
      // Don't fail the entire operation if KoboToolbox sync fails
      // The R pipeline will sync it on the next run
    }

    return { success: true, message: mongoResponse.data.message || 'Status updated successfully' };
  } catch (error) {
    console.error('Failed to update status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, message: `Failed to update: ${errorMessage}` };
  }
}; 