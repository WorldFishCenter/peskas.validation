import React, { useState, useEffect } from 'react';
import { generateEditUrl } from '../../api/koboToolbox';

interface Submission {
  submission_id: string;
  submission_date: string;
  vessel_number?: string;
  catch_number?: string;
  alert_number?: string;
  validation_status: string;
  validated_at: string;
}

interface StatusUpdateFormProps {
  selectedSubmission: Submission;
  status: string;
  setStatus: (status: string) => void;
  onUpdate: () => void;
  isUpdating: boolean;
  updateMessage: string | null;
}

const StatusUpdateForm: React.FC<StatusUpdateFormProps> = ({ 
  selectedSubmission, 
  status, 
  setStatus, 
  onUpdate, 
  isUpdating,
  updateMessage 
}) => {
  const [editUrl, setEditUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  // Fetch edit URL when selected submission changes
  useEffect(() => {
    const fetchEditUrl = async () => {
      if (selectedSubmission?.submission_id) {
        setIsLoadingUrl(true);
        try {
          const url = await generateEditUrl(selectedSubmission.submission_id);
          setEditUrl(url);
        } catch (error) {
          console.error("Failed to get edit URL:", error);
          setEditUrl(null);
        } finally {
          setIsLoadingUrl(false);
        }
      }
    };
    
    fetchEditUrl();
  }, [selectedSubmission]);

  return (
    <div>
      <div className="alert alert-info py-2 mb-3" style={{ maxWidth: '400px', borderLeft: '4px solid #0d6efd' }}>
        <div className="d-flex align-items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-info-circle" width="14" height="14" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
            <polyline points="11 12 12 12 12 16 13 16" />
          </svg>
          <div style={{ fontSize: '0.875rem' }}>
            Selected submission: {selectedSubmission.submission_id}
          </div>
        </div>
      </div>

      <div className="row g-2">
        <div className="col-auto">
          <div className="form-group mb-0">
            <label className="form-label">Assign Status</label>
            <div style={{ width: '200px' }}>
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
        </div>
        <div className="col-auto d-flex align-items-end">
          <button 
            className="btn btn-primary"
            style={{ height: '38px' }}
            onClick={onUpdate}
            disabled={isUpdating}
          >
            {isUpdating ? 'Updating...' : 'Update Status'}
          </button>
        </div>
        <div className="col-auto d-flex align-items-end">
          <a
            href={editUrl || "#"}
            target="_blank"
            className={`btn btn-secondary ${!editUrl ? 'disabled' : ''}`}
            style={{ height: '38px' }}
            rel="noreferrer"
          >
            {isLoadingUrl ? 'Loading Edit URL...' : 'Edit Submission'}
          </a>
        </div>
      </div>

      {updateMessage && (
        <div className="alert alert-primary mt-3">
          {updateMessage}
        </div>
      )}
    </div>
  );
};

export default StatusUpdateForm; 