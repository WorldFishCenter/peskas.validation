import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// API URL
const API_BASE_URL = 'http://localhost:3001/api';

interface Submission {
  submission_id: string;
  submission_date: string;
  vessel_number?: string;
  catch_number?: string;
  alert_flag: string;      // Original string from MongoDB
  alert_flags: string[];   // Parsed array for tooltip
  validation_status: string;
  validated_at: string;
}

// Hook to fetch submissions
export const useFetchSubmissions = () => {
  const [data, setData] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.get(`${API_BASE_URL}/submissions`);
      setData(response.data);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError('Failed to load submissions. Please try again later.');
      
      // Fallback to mock data if API fails
      setData([
        {
          submission_id: '645323011',
          submission_date: '2025-02-19',
          alert_flag: '',
          alert_flags: [],
          validation_status: 'validation_status_on_hold',
          validated_at: '2025-02-19T00:00:00.000Z'
        },
        {
          submission_id: '645327348',
          submission_date: '2025-02-19',
          alert_flag: '5, 9',
          alert_flags: ['5', '9'],
          validation_status: 'validation_status_on_hold',
          validated_at: '2025-02-19T00:00:00.000Z'
        },
        {
          submission_id: '645345830',
          submission_date: '2025-02-19',
          alert_flag: '5',
          alert_flags: ['5'],
          validation_status: 'validation_status_on_hold',
          validated_at: '2025-02-19T00:00:00.000Z'
        }
      ]);
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