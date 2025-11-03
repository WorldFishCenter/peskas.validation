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
import StatusUpdateForm from './StatusUpdateForm';
import { useFetchSubmissions, useFetchAlertCodes } from '../../api/api';
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

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return 'Never';
  try {
    // Check if the date string is actually a Unix timestamp (number)
    const timestamp = Number(dateStr);
    const date = !isNaN(timestamp) 
      ? new Date(timestamp * 1000)  // Convert seconds to milliseconds
      : new Date(dateStr);

    // Check if it's a valid date object
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return 'Invalid Date';
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
  const { data: submissions, isLoading, error, refetch } = useFetchSubmissions();
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

  // Get asset_id from first submission to fetch alert codes
  const assetId = submissions && submissions.length > 0 ? submissions[0].asset_id : null;
  const { alertCodes } = useFetchAlertCodes(assetId || null);

  useEffect(() => {
    // No-op: submissions are loaded and ready for display
  }, [submissions]);

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
        header: () => 'SUBMISSION ID',
        cell: info => info.getValue(),
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: fuzzyFilter,
      },
      {
        accessorKey: 'survey_name',
        header: () => 'SURVEY',
        cell: info => {
          const row = info.row.original;
          const surveyName = row.survey_name || 'Unknown';
          const countryCode = row.survey_country || '';
          const countryFlag = getCountryFlag(countryCode);
          const countryName = getCountryName(countryCode);
          return (
            <div>
              <div className="text-truncate" style={{ maxWidth: '12rem' }} title={surveyName}>
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
        accessorKey: 'survey_country',
        header: () => '',
        cell: () => null,
        enableSorting: false,
        enableColumnFilter: true,
        filterFn: 'equals',
      },
      {
        accessorKey: 'submitted_by',
        header: () => 'SUBMITTED BY',
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
        header: () => 'SUBMISSION DATE',
        cell: info => {
          const date = info.getValue() as string;
          if (!date) return 'N/A';
          try {
            // For submission date, we only want YYYY-MM-DD
            return date.split('T')[0];
          } catch (e) {
            return 'Invalid Date';
          }
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: dateRangeFilter,
      },
      {
        accessorKey: 'alert_flag',
        header: () => 'ALERT',
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
        header: () => 'STATUS',
        cell: info => <StatusBadge status={info.getValue() as string} />,
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: 'equals',
        size: 150,
        minSize: 150,
      },
      {
        accessorKey: 'validated_at',
        header: () => 'LAST VALIDATED',
        cell: info => formatDate(info.getValue() as string),
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: fuzzyFilter,
      },
    ],
    [fromDate, toDate]
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
      <div className="d-flex justify-content-center my-4">
        <div className="spinner-border text-blue"></div>
      </div>
    );
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="position-relative">
      <div className="card">
        <div className="card-header">
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
          />
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-vcenter table-hover">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        scope="col"
                        onClick={header.column.getToggleSortingHandler()}
                        className="text-center text-uppercase fw-semibold"
                        style={{
                          cursor: header.column.getCanSort() ? 'pointer' : 'default',
                        }}
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
                      className={
                        selectedRow?.submission_id === row.original.submission_id
                          ? 'table-active'
                          : ''
                      }
                      style={{ cursor: 'pointer' }}
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
                      No results found. Try adjusting your search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="d-flex flex-wrap align-items-center justify-content-between mt-4">
            <div className="d-flex align-items-center gap-2 mb-2">
              <select
                value={table.getState().pagination.pageSize}
                onChange={e => table.setPageSize(Number(e.target.value))}
                className="form-select"
                style={{ width: 'auto' }}
              >
                {[5, 10, 20, 25, 50].map(size => (
                  <option key={size} value={size}>
                    Show {size}
                  </option>
                ))}
              </select>
              <span className="text-muted">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
              </span>
              <span className="ms-2 text-muted">
                {table.getPrePaginationRowModel().rows.length} results
              </span>
            </div>
            <div className="d-flex gap-2 mb-2">
              <button
                className="btn btn-outline-primary"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </button>
              <button
                className="btn btn-outline-primary"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Offcanvas Sidebar */}
      {selectedRow && (
        <div className={`offcanvas offcanvas-end ${sidebarOpen ? 'show' : ''}`}
             tabIndex={-1}
             id="submissionSidebar"
             style={{ visibility: sidebarOpen ? 'visible' : 'hidden' }}>
          <div className="offcanvas-header border-bottom">
            <h5 className="offcanvas-title">Submission Details</h5>
            <button type="button" className="btn-close text-reset" onClick={() => setSidebarOpen(false)} aria-label="Close"></button>
          </div>
          <div className="offcanvas-body">
            <div className="card card-sm mb-3">
              <div className="card-body">
                <div className="d-flex justify-content-between mb-2">
                  <div className="text-muted">Submission ID:</div>
                  <div className="fw-bold">{selectedRow?.submission_id || 'N/A'}</div>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <div className="text-muted">Date:</div>
                  <div>{selectedRow?.submission_date ? formatDate(selectedRow.submission_date) : 'N/A'}</div>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <div className="text-muted">Submitted By:</div>
                  <div>{selectedRow?.submitted_by || 'Unknown'}</div>
                </div>
                {selectedRow?.vessel_number && (
                  <div className="d-flex justify-content-between mb-2">
                    <div className="text-muted">Vessel:</div>
                    <div>{selectedRow.vessel_number}</div>
                  </div>
                )}
                {selectedRow?.catch_number && (
                  <div className="d-flex justify-content-between mb-2">
                    <div className="text-muted">Catch #:</div>
                    <div>{selectedRow.catch_number}</div>
                  </div>
                )}
                <div className="d-flex justify-content-between mb-2">
                  <div className="text-muted">Status:</div>
                  <div>
                    <StatusBadge status={selectedRow.validation_status} />
                  </div>
                </div>
                {selectedRow?.alert_flag && selectedRow.alert_flag.trim() !== '' && (
                  <div className="d-flex justify-content-between mb-2">
                    <div className="text-muted">Alert Flags:</div>
                    <div>
                      <AlertBadge alertFlag={selectedRow.alert_flag} alertFlags={selectedRow.alert_flags} />
                    </div>
                  </div>
                )}
                <div className="d-flex justify-content-between">
                  <div className="text-muted">Last Validated:</div>
                  <div>{formatDate(selectedRow?.validated_at || null)}</div>
                </div>
              </div>
            </div>
            
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
      )}
      
      {/* Backdrop overlay */}
      {sidebarOpen && (
        <div className="offcanvas-backdrop fade show" onClick={() => setSidebarOpen(false)}></div>
      )}
      
      {/* Alert Guide Modal */}
      {showAlertGuide && (
        <AlertGuideModal
          onClose={() => setShowAlertGuide(false)}
          alertCodes={alertCodes}
        />
      )}
    </div>
  );
};

export default ValidationTable;