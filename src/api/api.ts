import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiConfig';

// Get the appropriate API base URL based on environment
const API_BASE_URL = getApiBaseUrl();

interface Submission {
  submission_id: string;
  submission_date: string;
  submitted_by?: string; // Make explicit that this might be missing
  vessel_number?: string;
  catch_number?: string;
  alert_flag: string;      // Original string from MongoDB
  alert_flags: string[];   // Parsed array for tooltip
  validation_status: string;
  validated_at: string;
}

// Normalize field names for consistent access
const normalizeSubmissionData = (item: any): any => {
  // Create a new object with all keys from the original
  const normalized = { ...item };
  
  // Look for variations of the submitted_by field
  // This handles different case variants that might come from the API
  if (normalized.submitted_by === undefined) {
    if (normalized.submittedBy !== undefined) {
      normalized.submitted_by = normalized.submittedBy;
    } else if (normalized.submittedby !== undefined) {
      normalized.submitted_by = normalized.submittedby;
    } else if (normalized.SubmittedBy !== undefined) {
      normalized.submitted_by = normalized.SubmittedBy;
    } else if (normalized._submitted_by !== undefined) {
      normalized.submitted_by = normalized._submitted_by;
    } else if (normalized.submitted_by_name !== undefined) {
      normalized.submitted_by = normalized.submitted_by_name;
    }
  }
  
  // Ensure submitted_by is always a string, even if empty
  normalized.submitted_by = normalized.submitted_by ? String(normalized.submitted_by) : '';
  
  return normalized;
};

// Hook to fetch submissions
export const useFetchSubmissions = () => {
  const [data, setData] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.get(`${API_BASE_URL}/kobo/submissions`);
      
      // Debug the response in production
      if (import.meta.env.PROD) {
        console.log('API URL:', API_BASE_URL);
        console.log('Response data structure:', 
          response.data.results ? 
          `Array with ${response.data.results.length} items` : 
          'Unexpected structure');
        
        if (response.data.results && response.data.results.length > 0) {
          console.log('First item sample:', response.data.results[0]);
          console.log('First item keys:', Object.keys(response.data.results[0]));
          
          // Try to find variants of the submitted_by field
          const item = response.data.results[0];
          console.log('Checking possible submitted_by field variations:');
          console.log('submitted_by:', item.submitted_by);
          console.log('submittedBy:', item.submittedBy);
          console.log('SubmittedBy:', item.SubmittedBy);
          console.log('_submitted_by:', item._submitted_by);
          console.log('submitted_by_name:', item.submitted_by_name);
        }
      }
      
      // Process and normalize all data
      const processedData = response.data.results.map(normalizeSubmissionData);
      
      setData(processedData);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError('Failed to load submissions');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
};

// Hook to update validation status
export const useUpdateValidationStatus = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  const updateStatus = async (submissionId: string, status: string) => {
    try {
      setIsUpdating(true);
      setUpdateMessage(null);
      
      const response = await axios.patch(`${API_BASE_URL}/submissions/${submissionId}/validation_status`, {
        validation_status: status
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
      console.log('Fetching enumerator statistics...');
      const response = await axios.get(`${API_BASE_URL}/enumerators-stats`, { 
        timeout: 10000 // 10 second timeout
      });
      
      if (!response.data) {
        throw new Error('Empty response received from server');
      }
      
      console.log(`Received ${response.data.length} enumerator records`);
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
        console.log(`Retrying (${retryCount + 1}/${maxRetries})...`);
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