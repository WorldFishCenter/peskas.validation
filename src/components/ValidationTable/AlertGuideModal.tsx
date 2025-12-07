import React, { useState, useMemo } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { getCountryFlag, getCountryName } from '../../utils/countryMetadata';

interface SurveyAlertCodes {
  surveyName: string;
  surveyCountry: string;
  assetId: string;
  alertCodes: Record<string, string>;
}

interface AlertGuideModalProps {
  onClose: () => void;
  surveyAlertCodes: SurveyAlertCodes[];
}

const AlertGuideModal: React.FC<AlertGuideModalProps> = ({ onClose, surveyAlertCodes }) => {
  const [selectedSurvey, setSelectedSurvey] = useState<string>(
    surveyAlertCodes.length > 0 ? surveyAlertCodes[0].assetId : ''
  );

  // Get the currently selected survey's alert codes
  const currentSurvey = useMemo(() => {
    return surveyAlertCodes.find(s => s.assetId === selectedSurvey) || surveyAlertCodes[0];
  }, [selectedSurvey, surveyAlertCodes]);

  if (!currentSurvey) {
    return (
      <div className="modal modal-blur show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Alert Codes Reference</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning">
                No alert codes available for the current data.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal modal-blur show d-block" tabIndex={-1} role="dialog">
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <IconAlertTriangle className="icon text-yellow me-2" size={24} stroke={2} />
              Alert Codes Reference
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body">
            {/* Info Banner */}
            <div className="alert alert-info d-flex align-items-center mb-3" role="alert">
              <div>
                <svg xmlns="http://www.w3.org/2000/svg" className="icon alert-icon" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                  <circle cx="12" cy="12" r="9"></circle>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  <polyline points="11 12 12 12 12 16 13 16"></polyline>
                </svg>
              </div>
              <div>
                Alert codes identify potential data quality issues that require validation attention.
              </div>
            </div>

            {/* Survey Selector - only show if multiple surveys */}
            {surveyAlertCodes.length > 1 && (
              <div className="mb-3">
                <label className="form-label">Survey</label>
                <select
                  className="form-select"
                  value={selectedSurvey}
                  onChange={(e) => setSelectedSurvey(e.target.value)}
                >
                  {surveyAlertCodes.map((survey) => {
                    const flag = getCountryFlag(survey.surveyCountry);
                    const country = getCountryName(survey.surveyCountry);
                    return (
                      <option key={survey.assetId} value={survey.assetId}>
                        {flag} {survey.surveyName} {country && `(${country})`}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Single Survey Header - only show if single survey */}
            {surveyAlertCodes.length === 1 && (
              <div className="mb-3">
                <div className="text-muted small">
                  Survey: <span className="fw-bold text-dark">
                    {getCountryFlag(currentSurvey.surveyCountry)} {currentSurvey.surveyName}
                  </span>
                </div>
              </div>
            )}

            {/* Alert Codes Table */}
            <div className="table-responsive">
              <table className="table table-vcenter card-table">
                <thead>
                  <tr>
                    <th className="w-1">Code</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(currentSurvey.alertCodes).map(([code, description]) => (
                    <tr key={code}>
                      <td>
                        <span className="badge bg-red-lt text-red fs-5">
                          {code}
                        </span>
                      </td>
                      <td className="text-wrap">
                        {description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn"
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