import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiConfig';

// Get the appropriate API base URL based on environment
const API_BASE_URL = getApiBaseUrl();

import { Submission } from '../types/validation';

// Normalize field names for consistent access
const normalizeSubmissionData = (item: any): any => {
  // Create a new object with all keys from the original
  const normalized = { ...item };
  
  
  // Handle common field name transformations
  if (!normalized.submitted_by && normalized._submitted_by) {
    normalized.submitted_by = normalized._submitted_by;
  }
  
  // Ensure submitted_by is always a string, even if empty
  normalized.submitted_by = normalized.submitted_by ? String(normalized.submitted_by) : '';
  
  
  return normalized;
};

// Hook to fetch submissions
export const useFetchSubmissions = () => {
  const [data, setData] = useState<Submission[]>([]);
  const [accessibleSurveys, setAccessibleSurveys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);


      const response = await axios.get(`${API_BASE_URL}/kobo/submissions`);


      // Process and normalize all data
      const processedData = response.data.results.map(normalizeSubmissionData);

      setData(processedData);

      // Store accessible surveys metadata
      if (response.data.metadata?.accessible_surveys) {
        setAccessibleSurveys(response.data.metadata.accessible_surveys);
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError('Failed to load submissions');
      setData([]);
      setAccessibleSurveys([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, accessibleSurveys, isLoading, error, refetch: fetchData };
};

// Hook to update validation status
export const useUpdateValidationStatus = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  const updateStatus = async (submissionId: string, status: string, assetId?: string) => {
    try {
      setIsUpdating(true);
      setUpdateMessage(null);

      const response = await axios.patch(`${API_BASE_URL}/submissions/${submissionId}/validation_status`, {
        validation_status: status,
        asset_id: assetId
      });

      setUpdateMessage(response.data.message || `Validation status correctly updated for submission ${submissionId}`);
      return true;
    } catch (err) {
      console.error('Error updating validation status:', err);
      setUpdateMessage('Error updating validation status. Please try again.');
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  return { updateStatus, isUpdating, updateMessage };
};

// Hook to fetch enumerator statistics from the new MongoDB collection
export const useFetchEnumeratorStats = () => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const maxRetries = 3;

  const fetchEnumeratorStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/enumerators-stats`, {
        timeout: 60000 // 60 second timeout for large datasets
      });

      if (!response.data) {
        throw new Error('Empty response received from server');
      }

      setData(response.data);
      setError(null);
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error('Error fetching enumerator stats:', error);

      // Extract the most useful error message
      let errorMessage = 'Failed to load enumerator statistics.';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      setError(errorMessage);

      // Auto-retry logic for certain types of errors
      if (retryCount < maxRetries && (error.code === 'ECONNABORTED' || error.response?.status === 500)) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          fetchEnumeratorStats();
        }, 2000 * (retryCount + 1)); // Progressive backoff
      }
    } finally {
      setIsLoading(false);
    }
  }, [retryCount]);

  useEffect(() => {
    fetchEnumeratorStats();
  }, [fetchEnumeratorStats]);

  // Provide a way to manually retry
  const refetch = useCallback(() => {
    setRetryCount(0); // Reset retry count on manual refetch
    return fetchEnumeratorStats();
  }, [fetchEnumeratorStats]);

  return { data, isLoading, error, refetch };
};

// Function to trigger a manual refresh of enumerator stats (admin only)
export const refreshEnumeratorStats = async (adminToken: string) => {
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

// Hook to fetch survey-specific alert codes
export const useFetchAlertCodes = (assetId: string | null) => {
  const [alertCodes, setAlertCodes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) return;

    const fetchAlertCodes = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_BASE_URL}/surveys/${assetId}/alert-codes`);
        setAlertCodes(response.data.alert_codes);
      } catch (err) {
        console.error('Error fetching alert codes:', err);
        setError('Failed to fetch alert codes');
        // Set default alert codes on error
        setAlertCodes({
          "1": "A catch was reported, but no taxon was specified",
          "2": "A taxon was specified, but no information was provided",
          "3": "Length is smaller than minimum length threshold",
          "4": "Length exceeds maximum length threshold",
          "5": "Bucket weight exceeds maximum (50kg)",
          "6": "Number of buckets exceeds maximum (300)",
          "7": "Number of individuals exceeds maximum (100)",
          "8": "Price per kg exceeds threshold",
          "9": "Catch per unit effort exceeds maximum",
          "10": "Revenue per unit effort exceeds threshold"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlertCodes();
  }, [assetId]);

  return { alertCodes, isLoading, error };
}; 