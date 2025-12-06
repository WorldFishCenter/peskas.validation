import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { IconKey, IconTrash, IconRefresh, IconUsers } from '@tabler/icons-react';
import { useFetchUsers, useFetchSurveys, deleteUser, User } from '../../api/admin';
import ResetPasswordModal from './ResetPasswordModal';
import { getApiBaseUrl } from '../../utils/apiConfig';
import { getCountryFlag, getCountryName } from '../../utils/countryMetadata';

const AdminUsers: React.FC = () => {
  const { data: users, isLoading, error, refetch } = useFetchUsers();
  const { data: surveys } = useFetchSurveys();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Column definitions
  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: 'username',
        header: () => 'USERNAME',
        cell: info => (
          <span className="text-reset fw-medium">{info.getValue() as string}</span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'name',
        header: () => 'NAME',
        cell: info => info.getValue() as string || <span className="text-secondary">—</span>,
        enableSorting: true,
      },
      {
        accessorKey: 'country',
        header: () => 'COUNTRY',
        cell: info => {
          const countries = info.getValue() as string[] | undefined;
          if (!countries || countries.length === 0) {
            return <span className="text-secondary">—</span>;
          }
          return (
            <div>
              {countries.map((code, idx) => (
                <span key={code}>
                  {getCountryFlag(code)} {getCountryName(code)}
                  {idx < countries.length - 1 && ', '}
                </span>
              ))}
            </div>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: 'role',
        header: () => 'ROLE',
        cell: info => {
          const role = info.getValue() as string;
          return (
            <span className={`badge ${role === 'admin' ? 'bg-purple-lt' : 'bg-blue-lt'}`}>
              {role === 'admin' ? 'Admin' : role === 'manager' ? 'Manager' : 'User'}
            </span>
          );
        },
        enableSorting: true,
      },
      {
        id: 'surveys',
        header: () => 'SURVEYS',
        cell: info => {
          const user = info.row.original;
          const surveyIds = user.permissions?.surveys || [];

          if (user.role === 'admin') {
            return <span className="badge bg-green-lt">All Surveys</span>;
          }

          if (surveyIds.length === 0) {
            return <span className="text-secondary">None</span>;
          }

          const assignedSurveys = surveys?.filter(s => surveyIds.includes(s.asset_id)) || [];

          if (assignedSurveys.length === 0) {
            return <span className="badge bg-yellow-lt">{surveyIds.length} unknown</span>;
          }

          if (assignedSurveys.length === 1) {
            return (
              <span className="badge bg-azure-lt" title={assignedSurveys[0].name}>
                {assignedSurveys[0].name}
              </span>
            );
          }

          return (
            <span
              className="badge bg-azure-lt"
              title={assignedSurveys.map(s => s.name).join(', ')}
            >
              {assignedSurveys.length} surveys
            </span>
          );
        },
      },
      {
        id: 'enumerators',
        header: () => 'ENUMERATORS',
        cell: info => {
          const user = info.row.original;
          const enumerators = user.permissions?.enumerators || [];

          if (user.role === 'admin') {
            return <span className="badge bg-green-lt">All</span>;
          }

          if (enumerators.length === 0) {
            return <span className="text-secondary">All</span>;
          }

          return (
            <span
              className="badge bg-cyan-lt"
              title={enumerators.join(', ')}
            >
              {enumerators.length} assigned
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: () => '',
        cell: info => {
          const user = info.row.original;
          return (
            <div className="btn-list flex-nowrap">
              <button
                className="btn btn-ghost-primary btn-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleResetPassword(user);
                }}
                title="Reset Password"
              >
                <IconKey size={18} stroke={1.5} />
              </button>
              <button
                className="btn btn-ghost-danger btn-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteUser(user);
                }}
                title="Delete User"
              >
                <IconTrash size={18} stroke={1.5} />
              </button>
            </div>
          );
        },
      },
    ],
    [surveys]
  );

  // TanStack Table setup
  const table = useReactTable({
    data: users,
    columns,
    state: {
      sorting,
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: setSorting,
    onPaginationChange: updater => {
      if (typeof updater === 'function') {
        const newState = updater({ pageIndex, pageSize });
        setPageIndex(newState.pageIndex);
        setPageSize(newState.pageSize);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const handleSyncFromAirtable = async () => {
    if (!confirm('This will sync all users from Airtable. Continue?')) {
      return;
    }

    setIsSyncing(true);
    try {
      const token = localStorage.getItem('authToken');

      if (!token) {
        alert('Authentication token not found. Please log in again.');
        return;
      }

      const API_BASE_URL = getApiBaseUrl();
      const response = await fetch(`${API_BASE_URL}/admin/sync-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        const message = `Sync complete!\nCreated: ${result.created}\nUpdated: ${result.updated}\nDeleted: ${result.deleted || 0}`;
        alert(message);
        refetch();
      } else {
        alert(`Sync failed: ${result.message}`);
      }
    } catch (err) {
      alert('Sync failed. Check console for details.');
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetPassword = (user: User) => {
    setSelectedUser(user);
    setShowResetPasswordModal(true);
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      return;
    }

    const result = await deleteUser(user._id);

    if (result.success) {
      alert(result.message);
      refetch();
    } else {
      alert(`Error: ${result.message}`);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="page-body">
        <div className="container-xl">
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-blue" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="page-body">
        <div className="container-xl">
          <div className="alert alert-danger">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <div className="page-pretitle">Administration</div>
              <h2 className="page-title">
                <IconUsers className="icon me-2" size={24} stroke={1.5} />
                User Management
              </h2>
            </div>
            <div className="col-auto ms-auto">
              <button
                className="btn btn-primary"
                onClick={handleSyncFromAirtable}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <IconRefresh className="icon me-1" size={18} stroke={1.5} />
                    Sync from Airtable
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Page Body */}
      <div className="page-body">
        <div className="container-xl">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Users</h3>
              <div className="card-actions">
                <span className="text-secondary">
                  {users.length} user{users.length !== 1 ? 's' : ''} total
                </span>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-vcenter card-table table-hover">
                <thead>
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                          className={header.column.getCanSort() ? 'cursor-pointer' : ''}
                        >
                          {header.isPlaceholder ? null : (
                            <div className="d-flex align-items-center gap-1">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getCanSort() && (
                                <span className="text-secondary">
                                  {{
                                    asc: ' ↑',
                                    desc: ' ↓',
                                  }[header.column.getIsSorted() as string] ?? ''}
                                </span>
                              )}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="text-center text-secondary py-4">
                        No users found. Click "Sync from Airtable" to import users.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map(row => (
                      <tr key={row.id}>
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {table.getPageCount() > 1 && (
              <div className="card-footer d-flex align-items-center">
                <p className="m-0 text-secondary">
                  Showing{' '}
                  <span>{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to{' '}
                  <span>
                    {Math.min(
                      (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                      users.length
                    )}
                  </span>{' '}
                  of <span>{users.length}</span> users
                </p>
                <ul className="pagination m-0 ms-auto">
                  <li className={`page-item ${!table.getCanPreviousPage() ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="icon" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <polyline points="15 6 9 12 15 18" />
                      </svg>
                      prev
                    </button>
                  </li>
                  <li className="page-item">
                    <select
                      value={table.getState().pagination.pageSize}
                      onChange={e => table.setPageSize(Number(e.target.value))}
                      className="form-select form-select-sm w-auto mx-2"
                    >
                      {[10, 20, 50].map(size => (
                        <option key={size} value={size}>
                          {size} / page
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
                      next
                      <svg xmlns="http://www.w3.org/2000/svg" className="icon" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <polyline points="9 6 15 12 9 18" />
                      </svg>
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedUser && (
        <ResetPasswordModal
          user={selectedUser}
          onClose={() => {
            setShowResetPasswordModal(false);
            setSelectedUser(null);
          }}
          onSuccess={refetch}
        />
      )}
    </>
  );
};

export default AdminUsers;
