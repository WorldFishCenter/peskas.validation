import React from 'react';
import { Table } from '@tanstack/react-table';
import { IconSearch } from '@tabler/icons-react';
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
  accessibleSurveys: any[];
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
  maxDate,
  accessibleSurveys
}: TableFiltersProps<T>) => {
  // Get columns with defensive access
  const statusColumn = table.getColumn('validation_status');
  const alertColumn = table.getColumn('alert_flag');
  const surveyColumn = table.getColumn('survey_name');

  // Get unique surveys from accessible surveys metadata (not from displayed rows)
  // This ensures all assigned surveys appear in dropdown, even if they have 0 submissions
  const uniqueSurveys = React.useMemo(() => {
    if (accessibleSurveys && accessibleSurveys.length > 0) {
      return accessibleSurveys.map(s => s.name).sort();
    }
    // Fallback to parsing displayed rows if metadata not available
    const surveys = new Set<string>();
    table.getRowModel().rows.forEach(row => {
      const surveyName = (row.original as any).survey_name;
      if (surveyName) surveys.add(surveyName);
    });
    return Array.from(surveys).sort();
  }, [accessibleSurveys, table]);

  return (
    <div className="d-flex flex-wrap gap-2 align-items-end">
      {/* Global Search */}
      <div className="flex-fill">
        <div className="input-group">
          <span className="input-group-text">
            <IconSearch className="icon" size={24} stroke={2} />
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
      </div>

      {/* Survey Filter */}
      {uniqueSurveys.length > 1 && (
        <div>
          <div className="input-group">
            <span className="input-group-text">Survey</span>
            <select
              className="form-select"
              value={(surveyColumn?.getFilterValue() as string) || ''}
              onChange={e =>
                surveyColumn?.setFilterValue(e.target.value || undefined)
              }
              disabled={!surveyColumn}
            >
              <option value="">All Surveys</option>
              {uniqueSurveys.map(survey => (
                <option key={survey} value={survey}>
                  {survey}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div>
        <div className="input-group">
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
      </div>

      {/* Alert Filter */}
      <div>
        <div className="input-group">
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
      </div>

      {/* Date Range Filter */}
      <div className="d-flex gap-2">
        <div>
          <label htmlFor="from-date" className="form-label mb-1 small">From</label>
          <input
            id="from-date"
            type="date"
            className="form-control"
            value={fromDate}
            min={minDate}
            max={toDate || maxDate}
            onChange={e => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="to-date" className="form-label mb-1 small">To</label>
          <input
            id="to-date"
            type="date"
            className="form-control"
            value={toDate}
            min={fromDate || minDate}
            max={maxDate}
            onChange={e => setToDate(e.target.value)}
          />
        </div>
      </div>

      {/* Reset Filters Button */}
      {(globalFilter || (table.getState().columnFilters.length > 0)) && (
        <div>
          <button
            className="btn btn-outline-secondary"
            onClick={resetFilters}
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};

export default TableFilters; 