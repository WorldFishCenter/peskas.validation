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
import { useFetchUsers, useFetchSurveys, deleteUser, User } from '../../api/admin';
import ResetPasswordModal from './ResetPasswordModal';
import { getApiBaseUrl } from '../../utils/apiConfig';

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
        header: 'Username',
        cell: info => <span className="fw-bold">{info.getValue() as string}</span>,
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: info => info.getValue() as string || <span className="text-muted">—</span>,
      },
      {
        accessorKey: 'country',
        header: 'Country',
        cell: info => {
          const country = info.getValue() as string[] | undefined;
          if (!country || country.length === 0) {
            return <span className="text-muted">—</span>;
          }
          return <span>{country.join(', ')}</span>;
        },
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: info => {
          const role = info.getValue() as string;
          return (
            <span className={`badge ${role === 'admin' ? 'bg-primary' : 'bg-secondary'}`}>
              {role === 'admin' ? 'Administrator' : 'User'}
            </span>
          );
        },
      },
      {
        id: 'surveys',
        header: 'Assigned Surveys',
        cell: info => {
          const user = info.row.original;
          const surveyIds = user.permissions?.surveys || [];

          if (user.role === 'admin') {
            return <span className="badge bg-success">All Surveys (Admin)</span>;
          }

          if (surveyIds.length === 0) {
            return <span className="text-muted">No surveys assigned</span>;
          }

          // Map asset IDs to survey names
          const assignedSurveys = surveys?.filter(s => surveyIds.includes(s.asset_id)) || [];

          if (assignedSurveys.length === 0) {
            return <span className="badge bg-warning">{surveyIds.length} unknown survey(s)</span>;
          }

          // Show first survey name + count if there are more
          if (assignedSurveys.length === 1) {
            return (
              <span className="badge bg-info" title={assignedSurveys[0].name}>
                {assignedSurveys[0].name}
              </span>
            );
          }

          // Multiple surveys - show expandable list
          return (
            <div className="dropdown">
              <button
                className="btn btn-sm btn-info dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                {assignedSurveys.length} survey(s)
              </button>
              <ul className="dropdown-menu">
                {assignedSurveys.map(survey => (
                  <li key={survey.asset_id}>
                    <span className="dropdown-item-text">
                      <strong>{survey.name}</strong>
                      <br />
                      <small className="text-muted">{survey.country_id}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: info => {
          const user = info.row.original;
          return (
            <div className="btn-list">
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => handleResetPassword(user)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-key" width="16" height="16" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                  <circle cx="8" cy="15" r="4"></circle>
                  <line x1="10.85" y1="12.15" x2="19" y2="4"></line>
                  <line x1="18" y1="5" x2="20" y2="7"></line>
                  <line x1="15" y1="8" x2="17" y2="10"></line>
                </svg>
                Reset Password
              </button>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => handleDeleteUser(user)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-trash" width="16" height="16" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                  <line x1="4" y1="7" x2="20" y2="7"></line>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                  <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"></path>
                  <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"></path>
                </svg>
                Delete
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
      // Get auth token from localStorage
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      const API_BASE_URL = getApiBaseUrl();
      const response = await fetch(`${API_BASE_URL}/admin/sync-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.username || ''}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        const message = `Sync complete!\nCreated: ${result.created}\nUpdated: ${result.updated}\nDeleted: ${result.deleted || 0}`;
        alert(message);
        refetch(); // Reload users list
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
      refetch(); // Reload users list
    } else {
      alert(`Error: ${result.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="container-xl py-4">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-xl py-4">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  return (
    <div className="container-xl py-4">
      <div className="page-header d-print-none">
        <div className="row align-items-center">
          <div className="col">
            <h2 className="page-title">User Management</h2>
            <div className="text-muted mt-1">
              Manage users and their survey access permissions
            </div>
          </div>
          <div className="col-auto ms-auto">
            <button
              className="btn btn-primary"
              onClick={() => handleSyncFromAirtable()}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Syncing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-refresh" width="20" height="20" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                    <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"></path>
                    <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"></path>
                  </svg>
                  Sync from Airtable
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-vcenter table-hover">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id}>
                        {header.isPlaceholder ? null : (
                          <div
                            className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                              asc: ' 🔼',
                              desc: ' 🔽',
                            }[header.column.getIsSorted() as string] ?? null}
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
                    <td colSpan={columns.length} className="text-center text-muted py-4">
                      No users found. Click "Create User" to add your first user.
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

          {/* Pagination */}
          {table.getPageCount() > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <div className="text-muted">
                Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  users.length
                )}{' '}
                of {users.length} users
              </div>
              <div className="btn-list">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </button>
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </button>
              </div>
            </div>
          )}
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
    </div>
  );
};

export default AdminUsers;
