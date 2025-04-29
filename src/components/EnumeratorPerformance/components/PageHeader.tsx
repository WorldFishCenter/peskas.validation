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
            <div className="btn-list">
              <div className="d-flex">
                <div className="btn-group me-2" role="group" aria-label="Time period">
                  <button type="button" 
                    className={`btn btn-sm ${timeframe === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setTimeframe('all')}>
                    All Time
                  </button>
                  <button type="button" 
                    className={`btn btn-sm ${timeframe === '7days' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setTimeframe('7days')}>
                    7 Days
                  </button>
                  <button type="button" 
                    className={`btn btn-sm ${timeframe === '30days' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setTimeframe('30days')}>
                    30 Days
                  </button>
                  <button type="button" 
                    className={`btn btn-sm ${timeframe === '90days' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setTimeframe('90days')}>
                    90 Days
                  </button>
                </div>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={refetch}
                  disabled={isRefreshing}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-refresh" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                    <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"></path>
                    <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"></path>
                  </svg>
                  Refresh
                </button>
                {isAdmin && (
                  <button 
                    className="btn btn-outline-primary btn-sm ms-2"
                    onClick={handleAdminRefresh}
                    disabled={isRefreshing}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-database" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                      <path d="M12 6m-8 0a8 3 0 1 0 16 0a8 3 0 1 0 -16 0"></path>
                      <path d="M4 6v6a8 3 0 0 0 16 0v-6"></path>
                      <path d="M4 12v6a8 3 0 0 0 16 0v-6"></path>
                    </svg>
                    Admin Refresh
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageHeader; 