import React from 'react';
import { Table } from '@tanstack/react-table';
import { IconSearch, IconInfoCircle } from '@tabler/icons-react';
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
  onShowAlertGuide?: () => void;
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
  accessibleSurveys,
  onShowAlertGuide
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
    <div className="d-flex flex-column gap-3">
      {/* Row 1: Search Bar + Alert Guide */}
      <div className="row g-2">
        <div className="col-md-8">
          <div className="input-group">
            <span className="input-group-text">
              <IconSearch className="icon" size={18} />
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Search submissions..."
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
            />
            {globalFilter && (
              <button
                className="btn"
                type="button"
                onClick={() => setGlobalFilter('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="col-md-4 d-flex gap-2">
          {/* Alert Guide Button */}
          {onShowAlertGuide && (
            <button
              className="btn btn-primary flex-fill"
              onClick={onShowAlertGuide}
            >
              <IconInfoCircle className="icon me-2" size={18} />
              Alert Guide
            </button>
          )}

          {/* Reset Filters Button */}
          {(globalFilter || (table.getState().columnFilters.length > 0)) && (
            <button
              className="btn flex-fill"
              onClick={resetFilters}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Filters Grid */}
      <div className="row g-2">
        {/* Survey Filter - only show if multiple surveys */}
        {uniqueSurveys.length > 1 && (
          <div className="col-md-3">
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
        )}

        {/* Status Filter */}
        <div className={uniqueSurveys.length > 1 ? 'col-md-3' : 'col-md-4'}>
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
                {status === 'validation_status_approved' && 'Approved'}
                {status === 'validation_status_not_approved' && 'Not Approved'}
                {status === 'validation_status_on_hold' && 'On Hold'}
              </option>
            ))}
          </select>
        </div>

        {/* Alert Filter */}
        <div className={uniqueSurveys.length > 1 ? 'col-md-2' : 'col-md-4'}>
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

        {/* Date Range */}
        <div className={uniqueSurveys.length > 1 ? 'col-md-4' : 'col-md-4'}>
          <div className="input-group">
            <input
              type="date"
              className="form-control"
              value={fromDate}
              min={minDate}
              max={toDate || maxDate}
              onChange={e => setFromDate(e.target.value)}
              aria-label="From date"
            />
            <span className="input-group-text">to</span>
            <input
              type="date"
              className="form-control"
              value={toDate}
              min={fromDate || minDate}
              max={maxDate}
              onChange={e => setToDate(e.target.value)}
              aria-label="To date"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TableFilters; 