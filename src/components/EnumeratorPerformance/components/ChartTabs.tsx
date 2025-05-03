import React, { useEffect } from 'react';
import { ChartTabType, TimeframeType, EnumeratorData } from '../types';
import SubmissionVolumeChart from '../charts/SubmissionVolumeChart';
import QualityRankingChart from '../charts/QualityRankingChart';
import SubmissionTrendChart from '../charts/SubmissionTrendChart';
import AlertDistributionChart from '../charts/AlertDistributionChart';

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
  // Initialize popovers when tab changes
  useEffect(() => {
    // Re-init Bootstrap popovers when tab changes
    if (typeof document !== 'undefined' && (window as any).bootstrap?.Popover) {
      const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
      [...popoverTriggerList].forEach(popoverTriggerEl => {
        new (window as any).bootstrap.Popover(popoverTriggerEl);
      });
    }
  }, [activeTab]);

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
              className={`nav-link ${activeTab === 'trends' ? 'active' : ''}`} 
              href="#"
              onClick={(e) => { e.preventDefault(); setActiveTab('trends'); }}
            >
              Submission Trends
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
              className={`nav-link ${activeTab === 'errors' ? 'active' : ''}`} 
              href="#"
              onClick={(e) => { e.preventDefault(); setActiveTab('errors'); }}
            >
              Error Distribution
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
          
          {/* Trends Tab */}
          <div className={`tab-pane ${activeTab === 'trends' ? 'active show' : ''}`}>
            <h3 className="card-title mb-1">Submission Trend Over Time</h3>
            <p className="text-muted small mb-3">Showing top 10 enumerators by submission volume (use mouse to zoom)</p>
            <SubmissionTrendChart 
              enumerators={enumerators} 
              timeframe={timeframe} 
              uniqueDates={uniqueDates}
              filterByTimeframe={filterByTimeframe}
            />
          </div>
          
          {/* Quality Tab */}
          <div className={`tab-pane ${activeTab === 'quality' ? 'active show' : ''}`}>
            <h3 className="card-title mb-1">Enumerator Quality Ranking</h3>
            <p className="text-muted small mb-3">Ranked by percentage of submissions without alerts</p>
            <div className="mb-4">
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
                <span className="ms-1">Click for more info</span>
              </span>
            </div>
            <QualityRankingChart 
              enumerators={enumerators} 
              timeframe={timeframe} 
            />
          </div>

          {/* Error Distribution Tab */}
          <div className={`tab-pane ${activeTab === 'errors' ? 'active show' : ''}`}>
            <h3 className="card-title mb-1">Alert Type Distribution</h3>
            <p className="text-muted small mb-3">Distribution of alert types across all enumerators</p>
            <div className="mb-4">
              <span 
                className="cursor-help" 
                data-bs-toggle="popover" 
                data-bs-placement="top" 
                data-bs-html="true"
                data-bs-trigger="hover focus"
                title="About Alert Distribution" 
                data-bs-content="
                  <strong>Alert Distribution:</strong> Breakdown of alert types across all enumerators.<br><br>
                  <strong>Purpose:</strong> Helps identify the most common validation issues for targeted training.<br><br>
                  <strong>Note:</strong> Only shows alert types that occur in the selected time period.
                "
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-info-circle text-primary" width="20" height="20" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                  <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path>
                  <path d="M12 8l.01 0"></path>
                  <path d="M11 12h1v4h1"></path>
                </svg>
                <span className="ms-1">Click for more info</span>
              </span>
            </div>
            <AlertDistributionChart 
              enumerators={enumerators} 
              timeframe={timeframe} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartTabs; 