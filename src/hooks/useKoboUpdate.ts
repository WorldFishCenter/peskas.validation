import { useState } from 'react';
import { updateValidationStatus } from '../api/koboToolbox';

export const useKoboUpdate = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  const updateStatus = async (submissionId: string, status: string) => {
    try {
      setIsUpdating(true);
      setUpdateMessage(null);
      
      const result = await updateValidationStatus(submissionId, status);
      setUpdateMessage(result.message);
      return result.success;
    } catch (error) {
      console.error('Error updating validation status:', error);
      setUpdateMessage('Error updating validation status. Please try again.');
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  return { updateStatus, isUpdating, updateMessage };
}; 