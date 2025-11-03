import React, { useState, useEffect } from 'react';
import { IconInfoCircle } from '@tabler/icons-react';
import { generateEditUrl } from '../../api/koboToolbox';

interface Submission {
  submission_id: string;
  submission_date: string;
  vessel_number?: string;
  catch_number?: string;
  alert_number?: string;
  validation_status: string;
  validated_at: string;
  asset_id?: string;
}

interface StatusUpdateFormProps {
  selectedSubmission: Submission;
  status: string;
  setStatus: (status: string) => void;
  onUpdate: () => void;
  isUpdating: boolean;
  updateMessage: string | null;
  hideSubmissionInfo?: boolean;
}

const StatusUpdateForm: React.FC<StatusUpdateFormProps> = ({ 
  selectedSubmission, 
  status, 
  setStatus, 
  onUpdate, 
  isUpdating,
  updateMessage,
  hideSubmissionInfo = false
}) => {
  const [editUrl, setEditUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlGeneratedTime, setUrlGeneratedTime] = useState<Date | null>(null);

  // Reset URL state when selected submission changes - with cleanup
  useEffect(() => {
    let mounted = true;
    
    if (mounted) {
      setEditUrl(null);
      setUrlGeneratedTime(null);
      setIsLoadingUrl(false);
    }
    
    return () => { mounted = false; };
  }, [selectedSubmission?.submission_id]); // Add optional chaining

  // Function to generate the URL when explicitly requested - with proper safeguards
  const handleGenerateEditUrl = async () => {
    if (!selectedSubmission?.submission_id) return;

    // Prevent multiple clicks
    if (isLoadingUrl) return;

    setIsLoadingUrl(true);
    try {
      const url = await generateEditUrl(selectedSubmission.submission_id, selectedSubmission.asset_id);
      
      // Set the URL regardless of loading state (remove the problematic check)
      setEditUrl(url);
      setUrlGeneratedTime(new Date());
      
      // Open URL in new tab with safeguards
      if (url) {
        const newWindow = window.open(url, '_blank');
        // Handle if popup was blocked
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          console.warn('Popup blocked or could not open window');
          // Show a message to the user
          alert('Popup was blocked. Please allow popups for this site.');
        }
      }
    } catch (error) {
      console.error("Failed to get edit URL:", error);
      setEditUrl(null);
    } finally {
      setIsLoadingUrl(false);
    }
  };

  // Calculate remaining time for URL validity
  const getRemainingTime = () => {
    if (!urlGeneratedTime) return 0;
    
    const now = new Date();
    const elapsedMs = now.getTime() - urlGeneratedTime.getTime();
    const remainingSeconds = Math.max(0, 30 - Math.floor(elapsedMs / 1000));
    return remainingSeconds;
  };

  const remainingSeconds = getRemainingTime();
  const urlValid = remainingSeconds > 0;

  return (
    <div>
      {!hideSubmissionInfo && (
        <div className="alert alert-info py-2 mb-3 border-start border-blue border-4">
          <div className="d-flex align-items-center gap-2">
            <IconInfoCircle className="icon" size={14} stroke={2} />
            <div className="small">
              Selected submission: {selectedSubmission.submission_id}
            </div>
          </div>
        </div>
      )}

      <div className="row g-2">
        <div className="col-auto">
          <div className="form-group mb-0">
            <label className="form-label">Assign Status</label>
            <select
              className="form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="validation_status_approved">Approved</option>
              <option value="validation_status_not_approved">Not Approved</option>
              <option value="validation_status_on_hold">On Hold</option>
            </select>
          </div>
        </div>
        <div className="col-auto d-flex align-items-end">
          <button
            className="btn btn-primary"
            onClick={onUpdate}
            disabled={isUpdating}
          >
            {isUpdating ? 'Updating...' : 'Update Status'}
          </button>
        </div>
        <div className="col-auto d-flex align-items-end">
          <button
            onClick={handleGenerateEditUrl}
            className="btn btn-secondary"
            disabled={isLoadingUrl}
          >
            {isLoadingUrl ? 'Generating Link...' : 'Go to Submission'}
          </button>
        </div>
      </div>

      {urlGeneratedTime && urlValid && (
        <div className="alert alert-success mt-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>Edit link opened in new tab.</strong>
            </div>
            {editUrl && (
              <a
                href={editUrl}
                target="_blank"
                className="btn btn-sm btn-green"
                rel="noreferrer"
              >
                Open Again
              </a>
            )}
          </div>
        </div>
      )}

      {updateMessage && (
        <div className="alert alert-info mt-3">
          {updateMessage}
        </div>
      )}
    </div>
  );
};

export default StatusUpdateForm; 