import React from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { ALERT_FLAG_DESCRIPTIONS } from '../../types/validation';

interface AlertGuideModalProps {
  onClose: () => void;
  alertCodes?: Record<string, string>;
}

const AlertGuideModal: React.FC<AlertGuideModalProps> = ({ onClose, alertCodes }) => {
  // Use provided alert codes or fall back to default hardcoded ones
  const displayCodes = alertCodes && Object.keys(alertCodes).length > 0 ? alertCodes : ALERT_FLAG_DESCRIPTIONS;
  return (
    <div className="modal modal-blur show d-block" tabIndex={-1} role="dialog">
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header bg-yellow-lt">
            <h5 className="modal-title">
              <IconAlertTriangle className="icon me-2" size={24} stroke={2} />
              Alert Codes Reference
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body p-4">
            <div className="alert alert-info mb-4">
              <strong>About Alert Codes:</strong> Alerts identify potential issues with a submission that require validation attention. Use this reference to understand what each alert code signifies.
            </div>
            <div className="table-responsive">
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th className="w-25">Alert Code</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(displayCodes).map(([code, description]) => (
                    <tr key={code}>
                      <td className="align-middle text-center">
                        <span className="badge bg-red-lt text-red fs-5 fw-semibold px-3 py-2">
                          Code {code}
                        </span>
                      </td>
                      <td className="align-middle fs-5 py-3">{description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-primary px-4" 
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertGuideModal; 