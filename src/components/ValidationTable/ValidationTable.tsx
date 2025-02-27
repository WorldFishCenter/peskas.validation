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
import { useFetchSubmissions } from '../../api/api';
import { logData } from '../../utils/debug';
import { updateValidationStatus } from '../../api/koboToolbox';

interface Submission {
  submission_id: string;
  submission_date: string;
  vessel_number: string;
  catch_number: string;
  alert_number?: string;
  validation_status: string;
  validated_at: string;
  alert_flag?: string;
  alert_flags?: string[];
}

// Define a fuzzy filter function using rankItem
const fuzzyFilter: FilterFn<Submission> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value);
  addMeta({ itemRank });
  return itemRank.passed;
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

  useEffect(() => {
    if (submissions && submissions.length > 0) {
      logData('Submissions data received:', submissions.slice(0, 3));
      const withAlerts = submissions.filter(
        s => s.alert_flag && s.alert_flag.trim() !== ''
      );
      logData('Items with alerts:', withAlerts.length);
      if (withAlerts.length > 0) {
        logData('Sample alert item:', withAlerts[0]);
      }
    }
  }, [submissions]);

  // Status options for filter dropdown
  const statusOptions = [
    'validation_status_pending',
    'validation_status_approved',
    'validation_status_rejected',
    'validation_status_requires_review'
  ];

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
        accessorKey: 'submission_date',
        header: () => 'SUBMISSION DATE',
        cell: info => (info.getValue() as string) || 'N/A',
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: fuzzyFilter,
      },
      {
        accessorKey: 'alert_flag',
        header: () => 'ALERT',
        cell: info => {
          const row = info.row.original;
          const alertFlag = info.getValue() as string;
          
          if (alertFlag && alertFlag.trim() !== '') {
            return (
              <span
                className="alert-badge"
                title={
                  row.alert_flags && row.alert_flags.length > 0
                    ? `Alerts: ${row.alert_flags.join(', ')}`
                    : `Alert: ${alertFlag}`
                }
                style={{
                  cursor: 'help',
                  textAlign: 'center',
                  display: 'block',
                  backgroundColor: 'rgba(220, 53, 69, 0.15)',
                  color: '#dc3545',
                  border: '1px solid rgba(220, 53, 69, 0.3)',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontWeight: '600',
                  fontSize: '0.85rem'
                }}
              >
                {alertFlag}
              </span>
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
        cell: info => {
          const status = info.getValue() as string;
          
          // Get appropriate styling based on status
          let backgroundColor = '#6c757d';
          let textColor = '#fff';
          let borderColor = '#6c757d';
          
          if (status) {
            if (status.includes('approved')) {
              backgroundColor = 'rgba(25, 135, 84, 0.15)';
              textColor = '#198754';
              borderColor = 'rgba(25, 135, 84, 0.3)';
            } else if (status.includes('rejected')) {
              backgroundColor = 'rgba(220, 53, 69, 0.15)';
              textColor = '#dc3545';
              borderColor = 'rgba(220, 53, 69, 0.3)';
            } else if (status.includes('pending')) {
              backgroundColor = 'rgba(255, 193, 7, 0.15)';
              textColor = '#664d03';
              borderColor = 'rgba(255, 193, 7, 0.3)';
            } else if (status.includes('review')) {
              backgroundColor = 'rgba(13, 110, 253, 0.15)';
              textColor = '#0d6efd';
              borderColor = 'rgba(13, 110, 253, 0.3)';
            }
          }
          
          return (
            <span
              style={{
                backgroundColor,
                color: textColor,
                border: `1px solid ${borderColor}`,
                borderRadius: '4px',
                padding: '4px 10px',
                display: 'inline-block',
                fontWeight: '500',
                fontSize: '0.875rem',
                textTransform: 'capitalize',
              }}
            >
              {status ? status.replace('validation_status_', '').replace(/_/g, ' ') : 'Unknown'}
            </span>
          );
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: 'equals',
      },
      {
        accessorKey: 'validated_at',
        header: () => 'LAST VALIDATED',
        cell: info => {
          const date = info.getValue() as string;
          if (!date) return 'Never';
          try {
            return new Date(date).toLocaleString();
          } catch (e) {
            return date || 'N/A';
          }
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: fuzzyFilter,
      },
    ],
    []
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
    },
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  const handleRowClick = (row: any) => {
    setSelectedRow(row.original);
  };

  const handleUpdateStatus = async () => {
    if (!selectedRow) return;
    
    setIsUpdating(true);
    try {
      const result = await updateValidationStatus(selectedRow.submission_id, statusToUpdate);
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
        <div className="spinner-border text-primary"></div>
      </div>
    );
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="card">
      <div className="card-header">
        <div className="d-flex gap-3 mt-2">
          {/* Global Search */}
          <div className="input-group" style={{ maxWidth: '300px' }}>
            <span className="input-group-text">
              <i className="fas fa-search"></i>
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
          
          {/* Status Filter */}
          <div className="input-group" style={{ maxWidth: '230px' }}>
            <span className="input-group-text">Status</span>
            <select
              className="form-select"
              value={(table.getColumn('validation_status')?.getFilterValue() as string) || ''}
              onChange={e =>
                table.getColumn('validation_status')?.setFilterValue(e.target.value || undefined)
              }
            >
              <option value="">All Statuses</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>
                  {status.replace('validation_status_', '').replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          
          {/* Alert Filter */}
          <div className="input-group" style={{ maxWidth: '200px' }}>
            <span className="input-group-text">Alert</span>
            <select
              className="form-select"
              value={(table.getColumn('alert_flag')?.getFilterValue() as string) || 'all'}
              onChange={e =>
                table.getColumn('alert_flag')?.setFilterValue(e.target.value)
              }
            >
              <option value="all">All Items</option>
              <option value="with-alerts">With Alerts</option>
              <option value="no-alerts">No Alerts</option>
            </select>
          </div>
          
          {/* Reset Filters Button */}
          {(globalFilter || table.getState().columnFilters.length > 0) && (
            <button
              className="btn btn-outline-secondary"
              onClick={() => {
                setGlobalFilter('');
                table.resetColumnFilters();
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
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
                      style={{
                        cursor: header.column.getCanSort() ? 'pointer' : 'default',
                        textAlign: 'center',
                        borderBottom: '2px solid #e9ecef',
                        padding: '12px 8px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <span style={{ marginLeft: '4px' }}>
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
                    style={{ 
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease-in-out'
                    }}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td 
                        key={cell.id} 
                        style={{ 
                          textAlign: 'center',
                          padding: '12px 8px',
                          verticalAlign: 'middle'
                        }}
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
      {selectedRow && (
        <div className="card-footer">
          <StatusUpdateForm
            selectedSubmission={selectedRow as any}
            status={statusToUpdate}
            setStatus={setStatusToUpdate}
            onUpdate={handleUpdateStatus}
            isUpdating={isUpdating}
            updateMessage={updateMessage}
          />
        </div>
      )}
    </div>
  );
};

export default ValidationTable;