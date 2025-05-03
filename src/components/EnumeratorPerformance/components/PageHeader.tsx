import React from 'react';
import { TimeframeType } from '../types';

interface PageHeaderProps {
  timeframe: TimeframeType;
  setTimeframe: (timeframe: TimeframeType) => void;
  refetch: () => void;
  isRefreshing: boolean;
  isAdmin: boolean;
  handleAdminRefresh: () => void;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  timeframe,
  setTimeframe,
  refetch,
  isRefreshing,
  isAdmin,
  handleAdminRefresh
}) => {
  return (
    <div className="page-header d-print-none mb-4">
      <div className="container-xl">
        <div className="row g-2 align-items-center">
          <div className="col">
            <h2 className="page-title">Enumerator Performance Dashboard</h2>
            <div className="text-muted mt-1">
              Monitor and analyze data collection performance metrics
            </div>
          </div>
          <div className="col-auto ms-auto d-print-none">
            <div className="d-flex align-items-center">
              <div className="btn-group shadow me-2" role="group" aria-label="Time period">
                <button type="button" 
                  className={`btn ${timeframe === 'all' ? 'btn-primary' : 'btn-outline-primary'} fw-medium px-3`}
                  onClick={() => setTimeframe('all')}>
                  All Time
                </button>
                <button type="button" 
                  className={`btn ${timeframe === '7days' ? 'btn-primary' : 'btn-outline-primary'} fw-medium px-3`}
                  onClick={() => setTimeframe('7days')}>
                  7 Days
                </button>
                <button type="button" 
                  className={`btn ${timeframe === '30days' ? 'btn-primary' : 'btn-outline-primary'} fw-medium px-3`}
                  onClick={() => setTimeframe('30days')}>
                  30 Days
                </button>
                <button type="button" 
                  className={`btn ${timeframe === '90days' ? 'btn-primary' : 'btn-outline-primary'} fw-medium px-3`}
                  onClick={() => setTimeframe('90days')}>
                  90 Days
                </button>
              </div>
              {isAdmin && (
                <button 
                  className="btn btn-outline-secondary d-flex align-items-center"
                  onClick={handleAdminRefresh}
                  disabled={isRefreshing}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-database me-1" width="20" height="20" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                    <path d="M12 6m-8 0a8 3 0 1 0 16 0a8 3 0 1 0 -16 0"></path>
                    <path d="M4 6v6a8 3 0 0 0 16 0v-6"></path>
                    <path d="M4 12v6a8 3 0 0 0 16 0v-6"></path>
                  </svg>
                  Refresh Data
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageHeader; 