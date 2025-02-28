import React from 'react';
import { Table } from '@tanstack/react-table';
import { Submission, VALIDATION_STATUS_OPTIONS } from '../../types/validation';

interface TableFiltersProps {
  table: Table<Submission>;
  globalFilter: string;
  setGlobalFilter: (filter: string) => void;
  showAlertGuide: () => void;
  resetFilters: () => void;
}

const TableFilters: React.FC<TableFiltersProps> = ({ 
  table, 
  globalFilter, 
  setGlobalFilter, 
  showAlertGuide,
  resetFilters
}) => {
  // Get columns with defensive access
  const statusColumn = table.getColumn('validation_status');
  const alertColumn = table.getColumn('alert_flag');

  return (
    <div className="d-flex gap-3 mt-2 flex-wrap">
      {/* Global Search */}
      <div className="input-group" style={{ maxWidth: '300px' }}>
        <span className="input-group-text">
          <svg xmlns="http://www.w3.org/2000/svg" className="icon" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <circle cx="10" cy="10" r="7" />
            <line x1="21" y1="21" x2="15" y2="15" />
          </svg>
        </span>
        <input
          type="text"
          className="form-control"
          placeholder="Search all columns..."
          value={globalFilter ?? ''}
          onChange={e => setGlobalFilter(e.target.value)}
        />
        {globalFilter && (
          <button
            className="btn btn-outline-secondary"
            type="button"
            onClick={() => setGlobalFilter('')}
          >
            ×
          </button>
        )}
      </div>
      
      {/* Status Filter - with defensive checks */}
      <div className="input-group" style={{ maxWidth: '230px' }}>
        <span className="input-group-text">Status</span>
        <select
          className="form-select"
          value={(statusColumn?.getFilterValue() as string) || ''}
          onChange={e =>
            statusColumn?.setFilterValue(e.target.value || undefined)
          }
          disabled={!statusColumn}
        >
          <option value="">All Statuses</option>
          {VALIDATION_STATUS_OPTIONS.map(status => (
            <option key={status} value={status}>
              {status === 'validation_status_approved' && 'APPROVED'}
              {status === 'validation_status_not_approved' && 'NOT APPROVED'}
              {status === 'validation_status_on_hold' && 'ON HOLD'}
            </option>
          ))}
        </select>
      </div>
      
      {/* Alert Filter - with defensive checks */}
      <div className="input-group" style={{ maxWidth: '200px' }}>
        <span className="input-group-text">Alert</span>
        <select
          className="form-select"
          value={(alertColumn?.getFilterValue() as string) || 'all'}
          onChange={e =>
            alertColumn?.setFilterValue(e.target.value)
          }
          disabled={!alertColumn}
        >
          <option value="all">All Items</option>
          <option value="with-alerts">With Alerts</option>
          <option value="no-alerts">No Alerts</option>
        </select>
      </div>
      
      {/* Alert Info Button */}
      <button 
        className="btn btn-outline-warning ms-3" 
        title="View Alert Codes Reference"
        onClick={showAlertGuide}
        style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          height: '38px'
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-alert-circle" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Alert Codes
      </button>
      
      {/* Reset Filters Button */}
      {(globalFilter || (table.getState().columnFilters.length > 0)) && (
        <button
          className="btn btn-outline-secondary"
          onClick={resetFilters}
        >
          Reset Filters
        </button>
      )}
    </div>
  );
};

export default TableFilters; 