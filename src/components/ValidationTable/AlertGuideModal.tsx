import React from 'react';
import { ALERT_FLAG_DESCRIPTIONS } from '../../types/validation';

interface AlertGuideModalProps {
  onClose: () => void;
}

const AlertGuideModal: React.FC<AlertGuideModalProps> = ({ onClose }) => {
  return (
    <div className="modal modal-blur show d-block" tabIndex={-1} role="dialog">
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header bg-warning-subtle">
            <h5 className="modal-title">
              <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-alert-triangle me-2" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <path d="M12 9v2m0 4v.01" />
                <path d="M5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75" />
              </svg>
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
                <thead className="table-light">
                  <tr>
                    <th style={{width: "20%"}}>Alert Code</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(ALERT_FLAG_DESCRIPTIONS).map(([code, description]) => (
                    <tr key={code}>
                      <td className="align-middle text-center">
                        <span
                          className="badge bg-danger-subtle text-danger"
                          style={{
                            fontSize: '1rem',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            fontWeight: '600'
                          }}
                        >
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