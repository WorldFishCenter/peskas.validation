import React from 'react';
import { ChartTabType, TimeframeType, EnumeratorData } from '../types';
import SubmissionVolumeChart from '../charts/SubmissionVolumeChart';
import QualityRankingChart from '../charts/QualityRankingChart';
import SubmissionTrendChart from '../charts/SubmissionTrendChart';

interface ChartTabsProps {
  activeTab: ChartTabType;
  setActiveTab: (tab: ChartTabType) => void;
  enumerators: EnumeratorData[];
  timeframe: TimeframeType;
  onEnumeratorSelect: (name: string) => void;
  uniqueDates: string[];
  filterByTimeframe: (date: string) => boolean;
}

const ChartTabs: React.FC<ChartTabsProps> = ({
  activeTab,
  setActiveTab,
  enumerators,
  timeframe,
  onEnumeratorSelect,
  uniqueDates,
  filterByTimeframe
}) => {
  return (
    <div className="card mb-4">
      <div className="card-header">
        <ul className="nav nav-tabs card-header-tabs" data-bs-toggle="tabs">
          <li className="nav-item">
            <a 
              className={`nav-link ${activeTab === 'volume' ? 'active' : ''}`} 
              href="#"
              onClick={(e) => { e.preventDefault(); setActiveTab('volume'); }}
            >
              Submission Volume
            </a>
          </li>
          <li className="nav-item">
            <a 
              className={`nav-link ${activeTab === 'quality' ? 'active' : ''}`} 
              href="#"
              onClick={(e) => { e.preventDefault(); setActiveTab('quality'); }}
            >
              Quality Metrics
            </a>
          </li>
          <li className="nav-item">
            <a 
              className={`nav-link ${activeTab === 'trends' ? 'active' : ''}`} 
              href="#"
              onClick={(e) => { e.preventDefault(); setActiveTab('trends'); }}
            >
              Submission Trends
            </a>
          </li>
        </ul>
      </div>
      <div className="card-body" style={{ minHeight: '600px' }}>
        <div className="tab-content">
          {/* Volume Tab */}
          <div className={`tab-pane ${activeTab === 'volume' ? 'active show' : ''}`}>
            <h3 className="card-title">Submission Volume by Enumerator</h3>
            <p className="text-muted mb-4">Click on any bar to view detailed statistics for that enumerator</p>
            <SubmissionVolumeChart 
              enumerators={enumerators} 
              timeframe={timeframe} 
              onEnumeratorSelect={onEnumeratorSelect} 
            />
          </div>
          
          {/* Quality Tab */}
          <div className={`tab-pane ${activeTab === 'quality' ? 'active show' : ''}`}>
            <div className="row">
              <div className="col-12">
                <div className="card border-0 shadow-none">
                  <div className="card-body p-0">
                    <div className="d-flex align-items-center mb-1">
                      <h3 className="card-title mb-0">Enumerator Quality Ranking</h3>
                      <div className="ms-2">
                        <span 
                          className="cursor-help" 
                          data-bs-toggle="popover" 
                          data-bs-placement="top" 
                          data-bs-html="true"
                          data-bs-trigger="hover focus"
                          title="Understanding Quality Metrics" 
                          data-bs-content="
                            <strong>Quality Score:</strong> Percentage of submissions without alerts (100% - Error Rate).<br><br>
                            <strong>Best Performer:</strong> Uses a weighted score that considers both quality and submission volume, requiring at least 5 submissions.<br><br>
                            <strong>Chart:</strong> Green bars show quality score (%), blue bars show submission count.
                          "
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-info-circle text-primary" width="20" height="20" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                            <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path>
                            <path d="M12 8l.01 0"></path>
                            <path d="M11 12h1v4h1"></path>
                          </svg>
                        </span>
                      </div>
                    </div>
                    <p className="text-muted small mb-3">Ranked by percentage of submissions without alerts</p>
                    <QualityRankingChart 
                      enumerators={enumerators} 
                      timeframe={timeframe} 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Trends Tab */}
          <div className={`tab-pane ${activeTab === 'trends' ? 'active show' : ''}`}>
            <h3 className="card-title mb-1">Submission Trend Over Time</h3>
            <p className="text-muted small mb-3">Showing top 10 enumerators by submission volume (use mouse to zoom)</p>
            <div className="mt-0">
              <SubmissionTrendChart 
                enumerators={enumerators} 
                timeframe={timeframe} 
                uniqueDates={uniqueDates}
                filterByTimeframe={filterByTimeframe}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartTabs; 