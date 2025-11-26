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

            {/* Survey Selector - only show if multiple surveys */}
            {surveyAlertCodes.length > 1 && (
              <div className="mb-4">
                <label className="form-label fw-bold">Select Survey:</label>
                <select
                  className="form-select form-select-lg"
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
              <div className="mb-4">
                <h6 className="text-muted">
                  Survey: <strong>
                    {getCountryFlag(currentSurvey.surveyCountry)} {currentSurvey.surveyName}
                  </strong>
                </h6>
              </div>
            )}

            {/* Alert Codes Table */}
            <div className="table-responsive">
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th className="w-25">Alert Code</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(currentSurvey.alertCodes).map(([code, description]) => (
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