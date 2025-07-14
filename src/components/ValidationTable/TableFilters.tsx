import { Table } from '@tanstack/react-table';
import { VALIDATION_STATUS_OPTIONS } from '../../types/validation';

interface TableFiltersProps<T> {
  table: Table<T>;
  globalFilter: string;
  setGlobalFilter: (filter: string) => void;
  resetFilters: () => void;
  fromDate: string;
  toDate: string;
  setFromDate: (date: string) => void;
  setToDate: (date: string) => void;
  minDate: string;
  maxDate: string;
}

const TableFilters = <T,>({ 
  table, 
  globalFilter, 
  setGlobalFilter, 
  resetFilters,
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  minDate,
  maxDate
}: TableFiltersProps<T>) => {
  // Get columns with defensive access
  const statusColumn = table.getColumn('validation_status');
  const alertColumn = table.getColumn('alert_flag');

  return (
    <div className="d-flex flex-row flex-nowrap gap-2 mt-2">
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