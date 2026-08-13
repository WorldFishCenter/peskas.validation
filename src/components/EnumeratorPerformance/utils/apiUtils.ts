import { extractErrorMessage } from '../../../utils/errors';
import axios from '../../../utils/axiosConfig';
import { getApiBaseUrl } from '../../../utils/apiConfig';

/**
 * Refresh enumerator statistics.
 *
 * Authorization is the caller's JWT: `api/admin/refresh-enumerator-stats.js` is wrapped in
 * `withMiddleware(authenticateUser, requireAdmin)`. This used to send an `Admin-Token` header
 * taken from a `prompt()`, which no endpoint has ever read — a second, purely decorative auth
 * scheme. The shared axios instance supplies the real credential.
 */
export const refreshEnumeratorStats = async () => {
  try {
    const response = await axios.post(`${getApiBaseUrl()}/admin/refresh-enumerator-stats`, {});
    return {
      success: true,
      message: response.data.message
    };
  } catch (error) {
    console.error('Error refreshing enumerator stats:', error);
    return {
      success: false,
      message: extractErrorMessage(error, 'Failed to refresh enumerator statistics')
    };
  }
};
