import React from 'react';

interface PageHeaderProps {
  isRefreshing: boolean;
  isAdmin: boolean;
  handleAdminRefresh: () => void;
  fromDate: string;
  toDate: string;
  setFromDate: (date: string) => void;
  setToDate: (date: string) => void;
  minDate: string;
  maxDate: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  isRefreshing,
  isAdmin,
  handleAdminRefresh,
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  minDate,
  maxDate
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
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {/* Date Range Filter */}
              <div className="d-flex align-items-center gap-2" style={{ minWidth: 320 }}>
                <div className="d-flex flex-column align-items-start" style={{ minWidth: 120 }}>
                  <label htmlFor="from-date" className="form-label mb-0" style={{ fontSize: '0.85em' }}>From</label>
                  <input
                    id="from-date"
                    type="date"
                    className="form-control"
                    style={{ minWidth: 120, maxWidth: 160 }}
                    value={fromDate}
                    min={minDate}
                    max={toDate || maxDate}
                    onChange={e => setFromDate(e.target.value)}
                  />
                </div>
                <div className="d-flex flex-column align-items-start" style={{ minWidth: 120 }}>
                  <label htmlFor="to-date" className="form-label mb-0" style={{ fontSize: '0.85em' }}>To</label>
                  <input
                    id="to-date"
                    type="date"
                    className="form-control"
                    style={{ minWidth: 120, maxWidth: 160 }}
                    value={toDate}
                    min={fromDate || minDate}
                    max={maxDate}
                    onChange={e => setToDate(e.target.value)}
                  />
                </div>
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