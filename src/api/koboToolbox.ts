import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiConfig';
import { extractErrorMessage } from '../utils/errors';

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
 * Update the validation status for a submission, in both KoboToolbox and MongoDB.
 *
 * **KoboToolbox is written first, and MongoDB only if that succeeds.**
 *
 * The external R pipeline reconciles MongoDB *from* KoboToolbox on every run, which makes
 * KoboToolbox the effective source of truth for validation status. Writing MongoDB first meant
 * that when the KoboToolbox call failed the caller was told the update had failed while MongoDB
 * had in fact already been changed — the two systems disagreed, and the next pipeline run
 * silently reverted the change. Doing the authoritative write first means a failure leaves both
 * systems untouched and the error the user sees is accurate.
 *
 * The trade-off is that a KoboToolbox outage now blocks the update outright instead of appearing
 * to work locally. That is deliberate: the local-only change never survived anyway.
 */
export const updateValidationStatus = async (
  submissionId: string,
  status: string,
  assetId?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    // Step 1: KoboToolbox — the authoritative write.
    const koboResponse = await axios.patch(`${API_BASE_URL}/kobo/validation-status/${submissionId}`, {
      validation_status: status,
      asset_id: assetId
    });

    if (!koboResponse.data.success) {
      throw new Error(koboResponse.data.message || 'Failed to update KoboToolbox');
    }

    // Step 2: MongoDB — what the portal reads, so the table reflects the change without
    // waiting for the next pipeline run. This is also where the audit event is recorded.
    const mongoResponse = await axios.patch(`${API_BASE_URL}/submissions/${submissionId}/validation-status`, {
      validation_status: status,
      asset_id: assetId
    });

    if (!mongoResponse.data.success) {
      throw new Error(mongoResponse.data.message || 'Failed to update MongoDB');
    }

    return { success: true, message: mongoResponse.data.message || 'Status updated successfully' };
  } catch (error) {
    console.error('Failed to update status:', error);
    // Prefer the server's own message ("You do not have access to the requested survey.") over
    // axios's generic "Request failed with status code 403".
    const errorMessage = extractErrorMessage(
      error,
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
    return { success: false, message: `Failed to update: ${errorMessage}` };
  }
}; 