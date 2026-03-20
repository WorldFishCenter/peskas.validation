import { Table } from '@tanstack/react-table';
import { IconSearch, IconInfoCircle } from '@tabler/icons-react';
import { VALIDATION_STATUS_OPTIONS } from '../../types/validation';
import { useTranslation } from 'react-i18next';

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
  selectedSurvey: string | null;
  onSurveyChange: (assetId: string | null) => void;
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
  selectedSurvey,
  onSurveyChange,
  onShowAlertGuide
}: TableFiltersProps<T>) => {
  const { t } = useTranslation('validation');

  // Get columns with defensive access
  const statusColumn = table.getColumn('validation_status');
  const alertColumn = table.getColumn('alert_flag');

  const showSurveySelector = accessibleSurveys.length > 1;

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
              placeholder={t('filters.searchPlaceholder')}
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
            />
            {globalFilter && (
              <button
                className="btn"
                type="button"
                onClick={() => setGlobalFilter('')}
                aria-label={t('filters.clearSearch')}
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
              {t('filters.alertGuide')}
            </button>
          )}

          {/* Reset Filters Button */}
          {(globalFilter || (table.getState().columnFilters.length > 0)) && (
            <button
              className="btn flex-fill"
              onClick={resetFilters}
            >
              {t('filters.resetFilters')}
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Filters Grid */}
      <div className="row g-2">
        {/* Survey Selector - only show if user has access to multiple surveys.
            Triggers an API-level refetch (not a client-side filter) so the correct
            survey's data is loaded from the backend. */}
        {showSurveySelector && (
          <div className="col-md-3">
            <select
              className="form-select"
              value={selectedSurvey || ''}
              onChange={e => onSurveyChange(e.target.value || null)}
            >
              {!selectedSurvey && (
                <option value="" disabled>{t('filters.selectSurvey')}</option>
              )}
              {accessibleSurveys.map(survey => (
                <option key={survey.asset_id} value={survey.asset_id}>
                  {survey.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Status Filter */}
        <div className={showSurveySelector ? 'col-md-3' : 'col-md-4'}>
          <select
            className="form-select"
            value={(statusColumn?.getFilterValue() as string) || ''}
            onChange={e =>
              statusColumn?.setFilterValue(e.target.value || undefined)
            }
            disabled={!statusColumn}
          >
            <option value="">{t('filters.allStatuses')}</option>
            {VALIDATION_STATUS_OPTIONS.map(status => (
              <option key={status} value={status}>
                {status === 'validation_status_approved' && t('status.approved', { ns: 'common' })}
                {status === 'validation_status_not_approved' && t('status.notApproved', { ns: 'common' })}
                {status === 'validation_status_on_hold' && t('status.onHold', { ns: 'common' })}
              </option>
            ))}
          </select>
        </div>

        {/* Alert Filter */}
        <div className={showSurveySelector ? 'col-md-2' : 'col-md-4'}>
          <select
            className="form-select"
            value={(alertColumn?.getFilterValue() as string) || 'all'}
            onChange={e =>
              alertColumn?.setFilterValue(e.target.value)
            }
            disabled={!alertColumn}
          >
            <option value="all">{t('filters.allItems')}</option>
            <option value="with-alerts">{t('filters.withAlerts')}</option>
            <option value="no-alerts">{t('filters.noAlerts')}</option>
          </select>
        </div>

        {/* Date Range */}
        <div className="col-md-4">
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
            <span className="input-group-text">{t('filters.dateTo')}</span>
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