import React, { useMemo, useState, useEffect } from 'react';
import { 
  useReactTable, 
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  Row
} from '@tanstack/react-table';
import StatusBadge from './StatusBadge';
import StatusUpdateForm from './StatusUpdateForm';
import { useFetchSubmissions, useUpdateValidationStatus } from '../../api/api';
import { logData } from '../../utils/debug';

interface Submission {
  submission_id: string;
  submission_date: string;
  vessel_number: string;
  catch_number: string;
  alert_number: string;
  validation_status: string;
  validated_at: string;
  alert_flags?: string[];
}

const ValidationTable: React.FC = () => {
  const { data: submissions, isLoading, error, refetch } = useFetchSubmissions();
  const { updateStatus, isUpdating, updateMessage } = useUpdateValidationStatus();
  const [selectedRow, setSelectedRow] = useState<Submission | null>(null);
  const [statusToUpdate, setStatusToUpdate] = useState<string>('validation_status_approved');
  
  useEffect(() => {
    if (submissions && submissions.length > 0) {
      logData('Submissions data received:', submissions.slice(0, 3));
      
      // Count items with alert flags
      const withAlerts = submissions.filter(s => s.alert_flag && s.alert_flag.trim() !== '');
      logData('Items with alerts:', withAlerts.length);
      if (withAlerts.length > 0) {
        logData('Sample alert item:', withAlerts[0]);
      }
    }
  }, [submissions]);

  const columns = useMemo<ColumnDef<Submission>[]>(
    () => [
      {
        accessorKey: 'submission_id',
        header: 'SUBMISSION ID',
        cell: info => info.getValue(),
      },
      {
        accessorKey: 'submission_date',
        header: 'SUBMISSION DATE',
        cell: info => {
          const date = info.getValue() as string;
          return date ? date : 'N/A';
        },
      },
      {
        accessorKey: 'alert_flag',
        header: 'ALERT',
        cell: info => {
          const row = info.row.original;
          const alertFlag = info.getValue() as string;
          
          // Log this row's alert data
          console.log(`Alert for row ${row.submission_id}:`, { 
            alertFlag, 
            hasValue: Boolean(alertFlag && alertFlag.trim() !== ''),
            flags: row.alert_flags
          });
          
          // More robust check for alert values
          if (alertFlag && alertFlag.trim() !== '') {
            return (
              <span 
                className="badge bg-danger" 
                title={row.alert_flags && row.alert_flags.length > 0 
                  ? `Alerts: ${row.alert_flags.join(', ')}` 
                  : `Alert: ${alertFlag}`}
                style={{ cursor: 'help' }}
              >
                {alertFlag}
              </span>
            );
          }
          return <span className="text-muted">—</span>; // Display a dash for empty values
        },
      },
      {
        accessorKey: 'validation_status',
        header: 'STATUS',
        cell: info => <StatusBadge status={info.getValue() as string} />,
      },
      {
        accessorKey: 'validated_at',
        header: 'LAST VALIDATED',
        cell: info => {
          const date = info.getValue() as string;
          try {
            if (!date) return 'Never';
            // Format the date to a more readable format
            const formattedDate = new Date(date).toLocaleString();
            return formattedDate;
          } catch (e) {
            return date || 'N/A';
          }
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: submissions || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const handleRowClick = (row: Row<Submission>) => {
    setSelectedRow(row.original);
  };

  const handleUpdateStatus = async () => {
    if (!selectedRow) return;
    
    await updateStatus(selectedRow.submission_id, statusToUpdate);
    refetch();
  };

  if (isLoading) return <div className="d-flex justify-content-center"><div className="spinner-border text-primary"></div></div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Submissions</h3>
      </div>
      <div className="card-body">
        <div className="table-responsive">
          <table className="table table-vcenter table-hover">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id}>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr 
                  key={row.id} 
                  onClick={() => handleRowClick(row)}
                  className={selectedRow?.submission_id === row.original.submission_id ? 'table-active' : ''}
                  style={{ cursor: 'pointer' }}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="d-flex justify-content-between align-items-center mt-3">
          <div className="d-flex gap-2">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </button>
          </div>
          <div>
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </div>
          <select
            value={table.getState().pagination.pageSize}
            onChange={e => {
              table.setPageSize(Number(e.target.value));
            }}
            className="form-select form-select-sm" 
            style={{ width: 'auto' }}
          >
            {[10, 20, 50, 100].map(pageSize => (
              <option key={pageSize} value={pageSize}>
                Show {pageSize}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedRow && (
        <div className="card-footer">
          <StatusUpdateForm
            selectedSubmission={selectedRow}
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