import React, { useMemo, useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  Row,
  ColumnFiltersState,
  FilterFn,
  SortingState,
} from '@tanstack/react-table';
import { rankItem } from '@tanstack/match-sorter-utils';
import { useTranslation } from 'react-i18next';
import StatusUpdateForm from './StatusUpdateForm';
import { useFetchSubmissions } from '../../api/api';
import { useContextualAlertCodes } from '../../hooks/useContextualAlertCodes';
import { updateValidationStatus } from '../../api/koboToolbox';
import { Submission } from '../../types/validation';
import AlertBadge from './AlertBadge';
import TableFilters from './TableFilters';
import AlertGuideModal from './AlertGuideModal';
import StatusBadge from './StatusBadge';
import { getCountryFlag, getCountryName } from '../../utils/countryMetadata';

// Define a fuzzy filter function using rankItem
const fuzzyFilter: FilterFn<Submission> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value);
  addMeta({ itemRank });
  return itemRank.passed;
};

const formatDateWithDefault = (dateStr: string | null, defaultText: string, invalidText: string): string => {
  if (!dateStr) return defaultText;
  try {
    // Check if the date string is actually a Unix timestamp (number)
    const timestamp = Number(dateStr);
    const date = !isNaN(timestamp)
      ? new Date(timestamp * 1000)  // Convert seconds to milliseconds
      : new Date(dateStr);

    // Check if it's a valid date object
    if (isNaN(date.getTime())) {
      return invalidText;
    }

    return date.toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return invalidText;
  }
};

// Helper to get min and max date from submissions
const getMinMaxDate = (subs: Submission[] | undefined): [string, string] => {
  if (!subs || subs.length === 0) return ['2024-02-01', '2024-02-01'];
  let min = subs[0].submission_date;
  let max = subs[0].submission_date;
  for (const s of subs) {
    if (s.submission_date && s.submission_date < min) min = s.submission_date;
    if (s.submission_date && s.submission_date > max) max = s.submission_date;
  }
  return [min.slice(0, 10), max.slice(0, 10)];
};

const ValidationTable: React.FC = () => {
  const { t } = useTranslation('validation');
  const { data: submissions, accessibleSurveys, isLoading, error, refetch } = useFetchSubmissions();
  const [selectedRow, setSelectedRow] = useState<Submission | null>(null);
  const [statusToUpdate, setStatusToUpdate] = useState<string>('validation_status_approved');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [showAlertGuide, setShowAlertGuide] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minDate, maxDate] = getMinMaxDate(submissions);
  const [contextualSubmissions, setContextualSubmissions] = useState<Submission[]>(submissions || []);

  // Helper function that uses translation
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return t('table.notAvailable');
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return t('table.invalidDate');
      }
      return date.toLocaleString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return t('table.invalidDate');
    }
  };

  // Sync contextualSubmissions when submissions first load
  useEffect(() => {
    if (submissions && submissions.length > 0 && contextualSubmissions.length === 0) {
      setContextualSubmissions(submissions);
    }
  }, [submissions, contextualSubmissions.length]);

  // Get contextual alert codes based on currently visible/filtered data
  const { surveyAlertCodes } = useContextualAlertCodes(contextualSubmissions);

  useEffect(() => {
    setFromDate(minDate);
    setToDate(maxDate);
  }, [minDate, maxDate]);

  const dateRangeFilter: FilterFn<Submission> = (row, columnId, value) => {
    const [from, to] = value as [string, string];
    const dateStr = row.getValue(columnId) as string;
    if (!dateStr) return false;
    const rowDate = dateStr.slice(0, 10);
    return (!from || rowDate >= from) && (!to || rowDate <= to);
  };

  const columns = useMemo<ColumnDef<Submission, unknown>[]>(
    () => [
      {
        accessorKey: 'submission_id',
        header: () => t('columns.submissionId'),
        cell: info => info.getValue(),
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: fuzzyFilter,
      },
      {
        accessorKey: 'survey_name',
        header: () => t('columns.survey'),
        cell: info => {
          const row = info.row.original;
          const surveyName = row.survey_name || t('table.unknownSurvey');
          const countryCode = row.survey_country || '';
          const countryFlag = getCountryFlag(countryCode);
          const countryName = getCountryName(countryCode);
          return (
            <div>
              <div className="text-truncate mw-12" title={surveyName}>
                {surveyName}
              </div>
              {countryCode && (
                <small className="text-muted">
                  {countryFlag} {countryName}
                </small>
              )}
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: fuzzyFilter,
      },
      {
        accessorKey: 'submitted_by',
        header: () => t('columns.enumerator'),
        cell: info => {
          const row = info.row.original;
          const value = info.getValue();
          
          
          // Try multiple ways to get the value
          let displayValue = value;
          
          // If the primary accessor didn't work, try direct access to the row
          if (!displayValue && row) {
            if (typeof row.submitted_by === 'string' && row.submitted_by.trim() !== '') {
              displayValue = row.submitted_by;
            } else if (typeof (row as any).submittedBy === 'string' && (row as any).submittedBy.trim() !== '') {
              displayValue = (row as any).submittedBy;
            }
          }
          
          // Final display logic
          return displayValue && String(displayValue).trim() !== '' 
            ? String(displayValue)
            : <span className="text-muted">—</span>;
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: fuzzyFilter,
      },
      {
        accessorKey: 'submission_date',
        header: () => t('columns.date'),
        cell: info => {
          const date = info.getValue() as string;
          if (!date) return t('table.notAvailable');
          try {
            // For submission date, we only want YYYY-MM-DD
            return date.split('T')[0];
          } catch (e) {
            return t('table.invalidDate');
          }
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: dateRangeFilter,
      },
      {
        accessorKey: 'alert_flag',
        header: () => t('columns.alert'),
        cell: info => {
          const row = info.row.original;
          const alertFlag = info.getValue() as string;
          
          if (alertFlag && alertFlag.trim() !== '') {
            return (
              <AlertBadge 
                alertFlag={alertFlag} 
                alertFlags={row.alert_flags} 
              />
            );
          }
          return <span className="text-muted">—</span>;
        },
        enableColumnFilter: true,
        filterFn: (row, columnId, filterValue) => {
          if (filterValue === 'all') return true;
          const alertFlag = row.getValue(columnId) as string;
          return filterValue === 'with-alerts' 
            ? Boolean(alertFlag && alertFlag.trim() !== '')
            : !alertFlag || alertFlag.trim() === '';
        },
      },
      {
        accessorKey: 'validation_status',
        header: () => t('columns.status'),
        cell: info => <StatusBadge status={info.getValue() as string} />,
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: 'equals',
        size: 150,
        minSize: 150,
      },
      {
        accessorKey: 'validated_at',
        header: () => t('columns.actions'),
        cell: info => formatDateWithDefault(info.getValue() as string, t('table.neverValidated'), t('table.invalidDate')),
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: fuzzyFilter,
      },
    ],
    [t, fromDate, toDate]
  );

  const table = useReactTable({
    data: submissions || [],
    columns: columns as any,
    state: {
      sorting,
      pagination: { pageIndex, pageSize },
      globalFilter,
      columnFilters,
    },
    onSortingChange: setSorting,
    onPaginationChange: updater => {
      if (typeof updater === 'function') {
        const newState = updater({ pageIndex, pageSize });
        setPageIndex(newState.pageIndex);
        setPageSize(newState.pageSize);
      }
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: fuzzyFilter as any,
    filterFns: {
      fuzzy: fuzzyFilter as any,
      dateRange: dateRangeFilter as any,
    },
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  useEffect(() => {
    table.getColumn('submission_date')?.setFilterValue([fromDate, toDate]);
  }, [fromDate, toDate, table]);

  // Update contextual submissions when filters change
  useEffect(() => {
    const filtered = table.getFilteredRowModel().rows.map(row => row.original);
    if (filtered.length > 0) {
      setContextualSubmissions(filtered);
    } else {
      setContextualSubmissions(submissions || []);
    }
  }, [table.getState().columnFilters, table.getState().globalFilter, submissions]);

  const handleRowClick = (row: Row<Submission>) => {
    setSelectedRow(row.original);
    setSidebarOpen(true);
    setUpdateMessage(null);
  };

  const handleUpdateStatus = async () => {
    if (!selectedRow) return;

    setIsUpdating(true);
    try {
      const result = await updateValidationStatus(selectedRow.submission_id, statusToUpdate, selectedRow.asset_id);
      setUpdateMessage(result.message);
      
      if (result.success) {
        // If the update was successful, refresh the data
        refetch();
      }
    } catch (error) {
      setUpdateMessage("An error occurred while updating the validation status");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading)
    return (
      <div className="page-body">
        <div className="container-xl">
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary"></div>
          </div>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="page-body">
        <div className="container-xl">
          <div className="alert alert-danger">{error}</div>
        </div>
      </div>
    );

  return (
    <>
      {/* Page Header */}
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <h2 className="page-title">{t('pageTitle')}</h2>
              <div className="text-muted mt-1">
                {t('pageDescription')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Page Body */}
      <div className="page-body">
        <div className="container-xl">
          {/* Filters Card */}
          <div className="card mb-3">
            <div className="card-body">
              <TableFilters
                table={table}
                globalFilter={globalFilter}
                setGlobalFilter={setGlobalFilter}
                resetFilters={() => {
                  setGlobalFilter('');
                  table.resetColumnFilters();
                  setFromDate(minDate);
                  setToDate(maxDate);
                  table.getColumn('submission_date')?.setFilterValue([minDate, maxDate]);
                }}
                fromDate={fromDate}
                toDate={toDate}
                setFromDate={(date: string) => {
                  setFromDate(date);
                  table.getColumn('submission_date')?.setFilterValue([date, toDate]);
                }}
                setToDate={(date: string) => {
                  setToDate(date);
                  table.getColumn('submission_date')?.setFilterValue([fromDate, date]);
                }}
                minDate={minDate}
                maxDate={maxDate}
                accessibleSurveys={accessibleSurveys}
                onShowAlertGuide={() => setShowAlertGuide(true)}
              />
            </div>
          </div>

          {/* Table Card */}
          <div className="card">
            <div className="table-responsive-fixed">
              <table className="table table-vcenter table-hover">
                <thead>
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          scope="col"
                          onClick={header.column.getToggleSortingHandler()}
                          className={`text-center text-uppercase fw-semibold ${header.column.getCanSort() ? 'cursor-pointer' : ''}`}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="ms-1">
                            {{
                              asc: ' ↑',
                              desc: ' ↓',
                              false: ' ↕',
                            }[header.column.getIsSorted() as string] ?? ' ↕'}
                          </span>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.length > 0 ? (
                    table.getRowModel().rows.map(row => (
                      <tr
                        key={row.id}
                        onClick={() => handleRowClick(row)}
                        className={`cursor-pointer ${
                          selectedRow?.submission_id === row.original.submission_id
                            ? 'table-active'
                            : ''
                        }`}
                      >
                        {row.getVisibleCells().map(cell => (
                          <td
                            key={cell.id}
                            className="text-center align-middle"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columns.length} className="text-center py-4">
                        {t('table.noResults')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="card-footer d-flex align-items-center">
              <p className="m-0 text-muted">
                {t('pagination.showing', { ns: 'common' })} <span>{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> {t('pagination.to', { ns: 'common' })} <span>{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getPrePaginationRowModel().rows.length)}</span> {t('pagination.of', { ns: 'common' })} <span>{table.getPrePaginationRowModel().rows.length}</span> {t('pagination.entries', { ns: 'common' })}
              </p>
              <ul className="pagination m-0 ms-auto">
                <li className={`page-item ${!table.getCanPreviousPage() ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="icon" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><polyline points="15 6 9 12 15 18" /></svg>
                    {t('table.prev')}
                  </button>
                </li>
                <li className="page-item">
                  <select
                    value={table.getState().pagination.pageSize}
                    onChange={e => table.setPageSize(Number(e.target.value))}
                    className="form-select form-select-sm w-auto"
                  >
                    {[5, 10, 20, 25, 50].map(size => (
                      <option key={size} value={size}>
                        {t('pagination.perPage', { ns: 'common', count: size })}
                      </option>
                    ))}
                  </select>
                </li>
                <li className={`page-item ${!table.getCanNextPage() ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    {t('table.next')}
                    <svg xmlns="http://www.w3.org/2000/svg" className="icon" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><polyline points="9 6 15 12 9 18" /></svg>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      {/* Offcanvas Sidebar */}
      {selectedRow && (
        <>
          {/* Backdrop overlay */}
          {sidebarOpen && (
            <div 
              className="offcanvas-backdrop fade show" 
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}
          
          <div
            className={`offcanvas offcanvas-end ${sidebarOpen ? 'show' : ''}`}
            tabIndex={-1}
            id="submissionSidebar"
            aria-labelledby="submissionSidebarLabel"
            aria-hidden={!sidebarOpen}
          >
            <div className="offcanvas-header">
              <h5 className="offcanvas-title" id="submissionSidebarLabel">{t('table.submissionDetails')}</h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setSidebarOpen(false)}
                aria-label={t('buttons.close', { ns: 'common' })}
              />
            </div>
            <div className="offcanvas-body">
              {/* Submission Details - Using Tabler description list pattern */}
              <div className="mb-4">
                <h6 className="text-muted text-uppercase fw-semibold mb-3">{t('table.submissionDetails')}</h6>
                <dl className="datagrid">
                  <div className="datagrid-item">
                    <div className="datagrid-title">{t('table.submissionIdLabel')}</div>
                    <div className="datagrid-content">
                      <strong>{selectedRow?.submission_id || t('table.notAvailable')}</strong>
                    </div>
                  </div>
                  <div className="datagrid-item">
                    <div className="datagrid-title">{t('table.dateLabel')}</div>
                    <div className="datagrid-content">
                      {selectedRow?.submission_date ? formatDate(selectedRow.submission_date) : t('table.notAvailable')}
                    </div>
                  </div>
                  <div className="datagrid-item">
                    <div className="datagrid-title">{t('table.submittedByLabel')}</div>
                    <div className="datagrid-content">
                      {selectedRow?.submitted_by || t('table.unknownEnumerator')}
                    </div>
                  </div>
                  {selectedRow?.vessel_number && (
                    <div className="datagrid-item">
                      <div className="datagrid-title">{t('table.vesselLabel')}</div>
                      <div className="datagrid-content">{selectedRow.vessel_number}</div>
                    </div>
                  )}
                  {selectedRow?.catch_number && (
                    <div className="datagrid-item">
                      <div className="datagrid-title">{t('table.catchNumberLabel')}</div>
                      <div className="datagrid-content">{selectedRow.catch_number}</div>
                    </div>
                  )}
                  <div className="datagrid-item">
                    <div className="datagrid-title">{t('table.statusLabel')}</div>
                    <div className="datagrid-content">
                      <StatusBadge status={selectedRow.validation_status} />
                    </div>
                  </div>
                  {selectedRow?.alert_flag && selectedRow.alert_flag.trim() !== '' && (
                    <div className="datagrid-item">
                      <div className="datagrid-title">{t('table.alertFlagsLabel')}</div>
                      <div className="datagrid-content">
                        <AlertBadge alertFlag={selectedRow.alert_flag} alertFlags={selectedRow.alert_flags} />
                      </div>
                    </div>
                  )}
                  <div className="datagrid-item">
                    <div className="datagrid-title">{t('table.lastValidatedLabel')}</div>
                    <div className="datagrid-content">
                      {formatDate(selectedRow?.validated_at || null)}
                    </div>
                  </div>
                </dl>
              </div>

              {/* Visual separator */}
              <hr className="my-4" />

              {/* Status Update Form Section */}
              <div>
                <h6 className="text-muted text-uppercase fw-semibold mb-3">{t('form.updateStatus')}</h6>
                <StatusUpdateForm
                  selectedSubmission={selectedRow}
                  status={statusToUpdate}
                  setStatus={setStatusToUpdate}
                  onUpdate={handleUpdateStatus}
                  isUpdating={isUpdating}
                  updateMessage={updateMessage}
                  hideSubmissionInfo={true}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Alert Guide Modal */}
      {showAlertGuide && (
        <AlertGuideModal
          onClose={() => setShowAlertGuide(false)}
          surveyAlertCodes={surveyAlertCodes}
        />
      )}
    </>
  );
};

export default ValidationTable;