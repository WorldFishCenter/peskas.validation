import { IconPrinter, IconClipboardCheck, IconChartBar, IconEye, IconEdit, IconAlertTriangle } from '@tabler/icons-react';
import './HowItWorks.css';

const HowItWorks = () => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page">
      {/* Page Header */}
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <h2 className="page-title">User Guide</h2>
              <div className="text-muted mt-1">
                Instructions for monitoring data quality and enumerator performance
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Page Body */}
      <div className="page-body">
        <div className="container-xl">

          {/* Your Role Section */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-body">
                  <h2 className="card-title mb-3">Overview</h2>
                  <p className="text-muted mb-4">
                    This portal helps you supervise data quality from field enumerators who collect fishery catch data.
                    Your responsibilities include monitoring enumerator performance, reviewing data submissions for accuracy,
                    and providing feedback to improve data collection quality.
                  </p>
                  <div className="row">
                    <div className="col-md-4 mb-3 mb-md-0">
                      <div className="d-flex align-items-start">
                        <IconEye className="icon text-primary me-2 flex-shrink-0" style={{ marginTop: '2px' }} />
                        <div>
                          <strong>Monitor Performance</strong>
                          <div className="text-muted small">Track enumerator activity and data quality metrics</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4 mb-3 mb-md-0">
                      <div className="d-flex align-items-start">
                        <IconAlertTriangle className="icon text-primary me-2 flex-shrink-0" style={{ marginTop: '2px' }} />
                        <div>
                          <strong>Review Alerts</strong>
                          <div className="text-muted small">Examine submissions flagged with data quality issues</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="d-flex align-items-start">
                        <IconEdit className="icon text-primary me-2 flex-shrink-0" style={{ marginTop: '2px' }} />
                        <div>
                          <strong>Validate & Guide</strong>
                          <div className="text-muted small">Approve data and provide feedback for improvement</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Two Main Pages Section */}
          <div className="row mb-4">
            <div className="col-12">
              <h2 className="mb-3">Main Features</h2>
            </div>
          </div>

          <div className="row row-cards mb-4">
            {/* Validation Table Card */}
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex align-items-center mb-3">
                    <IconClipboardCheck className="icon text-primary me-2" />
                    <h3 className="card-title mb-0">Validation Table</h3>
                  </div>
                  <p className="text-muted mb-3">
                    Review individual submissions and update validation status based on data quality.
                  </p>
                  <ul className="list-unstyled">
                    <li className="mb-2 text-muted">• View all submissions from enumerators</li>
                    <li className="mb-2 text-muted">• Identify submissions with alert flags</li>
                    <li className="mb-2 text-muted">• Update validation status (Approved/Not Approved)</li>
                    <li className="mb-2 text-muted">• Filter by enumerator, date, or survey</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Enumerator Performance Card */}
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex align-items-center mb-3">
                    <IconChartBar className="icon text-primary me-2" />
                    <h3 className="card-title mb-0">Enumerator Performance</h3>
                  </div>
                  <p className="text-muted mb-3">
                    Monitor performance metrics and identify areas requiring attention or training.
                  </p>
                  <ul className="list-unstyled">
                    <li className="mb-2 text-muted">• View quality rankings by error rate</li>
                    <li className="mb-2 text-muted">• Track submission volume over time</li>
                    <li className="mb-2 text-muted">• Analyze common alert types</li>
                    <li className="mb-2 text-muted">• Compare performance across enumerators</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Step-by-Step Guide Section */}
          <div className="row mb-4">
            <div className="col-12">
              <h2 className="mb-3">Your Weekly Workflow</h2>
              <p className="text-muted">Follow these steps to review and validate data submissions</p>
            </div>
          </div>

          <div className="card mb-4">
            <div className="list-group list-group-flush">

              {/* Step 1 */}
              <div className="list-group-item">
                <div className="row align-items-center">
                  <div className="col-auto">
                    <span className="avatar" style={{ backgroundColor: '#206bc4', color: 'white' }}>1</span>
                  </div>
                  <div className="col">
                    <div className="text-truncate">
                      <strong>Open the Validation Table</strong>
                    </div>
                    <div className="text-muted">Navigate to "Validation" in the top menu to view all submissions</div>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="list-group-item">
                <div className="row align-items-center">
                  <div className="col-auto">
                    <span className="avatar" style={{ backgroundColor: '#206bc4', color: 'white' }}>2</span>
                  </div>
                  <div className="col">
                    <div className="text-truncate">
                      <strong>Identify submissions with alerts</strong>
                    </div>
                    <div className="text-muted">Look for submissions marked with red alert badges indicating potential data issues</div>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="list-group-item">
                <div className="row align-items-center">
                  <div className="col-auto">
                    <span className="avatar" style={{ backgroundColor: '#206bc4', color: 'white' }}>3</span>
                  </div>
                  <div className="col">
                    <div className="text-truncate">
                      <strong>Review submission details</strong>
                    </div>
                    <div className="text-muted">Click on a submission to examine the data and verify accuracy</div>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="list-group-item">
                <div className="row align-items-center">
                  <div className="col-auto">
                    <span className="avatar" style={{ backgroundColor: '#206bc4', color: 'white' }}>4</span>
                  </div>
                  <div className="col">
                    <div className="text-truncate">
                      <strong>Update validation status</strong>
                    </div>
                    <div className="text-muted">Set status as Approved or Not Approved based on your review</div>
                  </div>
                </div>
              </div>

              {/* Step 5 */}
              <div className="list-group-item">
                <div className="row align-items-center">
                  <div className="col-auto">
                    <span className="avatar" style={{ backgroundColor: '#206bc4', color: 'white' }}>5</span>
                  </div>
                  <div className="col">
                    <div className="text-truncate">
                      <strong>Provide feedback to enumerators</strong>
                    </div>
                    <div className="text-muted">Communicate findings and improvement areas using the Enumerator Performance page</div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Understanding Key Concepts */}
          <div className="row mb-4">
            <div className="col-12">
              <h2 className="mb-3">Key Concepts</h2>
            </div>
          </div>

          <div className="row row-cards mb-4">
            {/* Understanding Alert Flags */}
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-body">
                  <h3 className="mb-3">Alert Flags</h3>
                  <p className="text-muted mb-3">
                    Automatic indicators that highlight potential data quality issues requiring review.
                  </p>
                  <div className="mb-3">
                    <div className="d-flex align-items-center mb-2">
                      <span className="badge bg-red text-white me-2">Code</span>
                      <span className="text-muted">Indicates specific data quality concern</span>
                    </div>
                    <div className="d-flex align-items-center">
                      <span className="badge bg-green text-white me-2">NA</span>
                      <span className="text-muted">No alerts detected</span>
                    </div>
                  </div>
                  <p className="text-muted small mb-0">
                    <strong>Note:</strong> Alert flags are automated warnings. Final validation decisions are made by you.
                  </p>
                </div>
              </div>
            </div>

            {/* Understanding Validation Status */}
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-body">
                  <h3 className="mb-3">Validation Status</h3>
                  <p className="text-muted mb-3">
                    Your decision on the accuracy and acceptability of submitted data.
                  </p>
                  <div className="mb-3">
                    <div className="d-flex align-items-center mb-2">
                      <span className="status status-success me-2"></span>
                      <span><strong>Approved:</strong> <span className="text-muted">Data verified as accurate</span></span>
                    </div>
                    <div className="d-flex align-items-center">
                      <span className="status status-danger me-2"></span>
                      <span><strong>Not Approved:</strong> <span className="text-muted">Data contains errors</span></span>
                    </div>
                  </div>
                  <p className="text-muted small mb-0">
                    <strong>Note:</strong> Review data thoroughly before updating validation status.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Support Section */}
          <div className="row">
            <div className="col-12">
              <div className="card bg-blue-lt">
                <div className="card-body">
                  <h3 className="mb-2">Need Assistance?</h3>
                  <p className="text-muted mb-0">
                    Contact your system administrator for technical support or questions about using this portal.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
