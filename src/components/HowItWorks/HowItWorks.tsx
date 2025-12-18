import { IconClipboardCheck, IconChartBar, IconEye, IconEdit, IconAlertTriangle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import './HowItWorks.css';

const HowItWorks = () => {
  const { t } = useTranslation('guide');

  return (
    <div className="page">
      {/* Page Header */}
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <h2 className="page-title">{t('pageTitle')}</h2>
              <div className="text-muted mt-1">
                {t('pageSubtitle')}
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
                  <h2 className="card-title mb-3">{t('overview')}</h2>
                  <p className="text-muted mb-4">
                    {t('overviewText')}
                  </p>
                  <div className="row">
                    <div className="col-md-4 mb-3 mb-md-0">
                      <div className="d-flex align-items-start">
                        <IconEye className="icon text-primary me-2 flex-shrink-0" style={{ marginTop: '2px' }} />
                        <div>
                          <strong>{t('monitorPerformance')}</strong>
                          <div className="text-muted small">{t('monitorDescription')}</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4 mb-3 mb-md-0">
                      <div className="d-flex align-items-start">
                        <IconAlertTriangle className="icon text-primary me-2 flex-shrink-0" style={{ marginTop: '2px' }} />
                        <div>
                          <strong>{t('reviewAlerts')}</strong>
                          <div className="text-muted small">{t('reviewDescription')}</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="d-flex align-items-start">
                        <IconEdit className="icon text-primary me-2 flex-shrink-0" style={{ marginTop: '2px' }} />
                        <div>
                          <strong>{t('validateGuide')}</strong>
                          <div className="text-muted small">{t('validateDescription')}</div>
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
              <h2 className="mb-3">{t('mainFeatures')}</h2>
            </div>
          </div>

          <div className="row row-cards mb-4">
            {/* Validation Table Card */}
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex align-items-center mb-3">
                    <IconClipboardCheck className="icon text-primary me-2" />
                    <h3 className="card-title mb-0">{t('validationTable')}</h3>
                  </div>
                  <p className="text-muted mb-3">
                    {t('validationDescription')}
                  </p>
                  <ul className="list-unstyled">
                    <li className="mb-2 text-muted">• {t('validationBullet1')}</li>
                    <li className="mb-2 text-muted">• {t('validationBullet2')}</li>
                    <li className="mb-2 text-muted">• {t('validationBullet3')}</li>
                    <li className="mb-2 text-muted">• {t('validationBullet4')}</li>
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
                    <h3 className="card-title mb-0">{t('enumeratorPerformance')}</h3>
                  </div>
                  <p className="text-muted mb-3">
                    {t('performanceDescription')}
                  </p>
                  <ul className="list-unstyled">
                    <li className="mb-2 text-muted">• {t('performanceBullet1')}</li>
                    <li className="mb-2 text-muted">• {t('performanceBullet2')}</li>
                    <li className="mb-2 text-muted">• {t('performanceBullet3')}</li>
                    <li className="mb-2 text-muted">• {t('performanceBullet4')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Step-by-Step Guide Section */}
          <div className="row mb-4">
            <div className="col-12">
              <h2 className="mb-3">{t('weeklyWorkflow')}</h2>
              <p className="text-muted">{t('workflowDescription')}</p>
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
                      <strong>{t('step1Title')}</strong>
                    </div>
                    <div className="text-muted">{t('step1Description')}</div>
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
                      <strong>{t('step2Title')}</strong>
                    </div>
                    <div className="text-muted">{t('step2Description')}</div>
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
                      <strong>{t('step3Title')}</strong>
                    </div>
                    <div className="text-muted">{t('step3Description')}</div>
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
                      <strong>{t('step4Title')}</strong>
                    </div>
                    <div className="text-muted">{t('step4Description')}</div>
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
                      <strong>{t('step5Title')}</strong>
                    </div>
                    <div className="text-muted">{t('step5Description')}</div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Understanding Key Concepts */}
          <div className="row mb-4">
            <div className="col-12">
              <h2 className="mb-3">{t('keyConcepts')}</h2>
            </div>
          </div>

          <div className="row row-cards mb-4">
            {/* Understanding Alert Flags */}
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-body">
                  <h3 className="mb-3">{t('alertFlags')}</h3>
                  <p className="text-muted mb-3">
                    {t('alertFlagsDescription')}
                  </p>
                  <div className="mb-3">
                    <div className="d-flex align-items-center mb-2">
                      <span className="badge bg-red text-white me-2">{t('codeLabel')}</span>
                      <span className="text-muted">{t('codeDescription')}</span>
                    </div>
                    <div className="d-flex align-items-center">
                      <span className="badge bg-green text-white me-2">{t('naLabel')}</span>
                      <span className="text-muted">{t('naDescription')}</span>
                    </div>
                  </div>
                  <p className="text-muted small mb-0">
                    <strong>Note:</strong> {t('alertFlagsNote')}
                  </p>
                </div>
              </div>
            </div>

            {/* Understanding Validation Status */}
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-body">
                  <h3 className="mb-3">{t('validationStatus')}</h3>
                  <p className="text-muted mb-3">
                    {t('validationStatusDescription')}
                  </p>
                  <div className="mb-3">
                    <div className="d-flex align-items-center mb-2">
                      <span className="status status-success me-2"></span>
                      <span><strong>{t('approvedStatus')}</strong> <span className="text-muted">{t('approvedDescription')}</span></span>
                    </div>
                    <div className="d-flex align-items-center">
                      <span className="status status-danger me-2"></span>
                      <span><strong>{t('notApprovedStatus')}</strong> <span className="text-muted">{t('notApprovedDescription')}</span></span>
                    </div>
                  </div>
                  <p className="text-muted small mb-0">
                    <strong>Note:</strong> {t('validationStatusNote')}
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
                  <h3 className="mb-2">{t('needAssistance')}</h3>
                  <p className="text-muted mb-0">
                    {t('assistanceText')}
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
