import axios from 'axios';
import { getApiBaseUrl } from '../../../utils/apiConfig';

/**
 * Refresh enumerator statistics
 */
export const refreshEnumeratorStats = async (adminToken: string) => {
  const API_BASE_URL = getApiBaseUrl();
  try {
    const response = await axios.post(
      `${API_BASE_URL}/admin/refresh-enumerator-stats`,
      {},
      {
        headers: {
          'Admin-Token': adminToken
        }
      }
    );
    return {
      success: true,
      message: response.data.message
    };
  } catch (error) {
    console.error('Error refreshing enumerator stats:', error);
    return {
      success: false,
      message: (error as any).response?.data?.error || 'Failed to refresh enumerator statistics'
    };
  }
}; 