import { useState } from 'react';
import { ColumnFiltersState, SortingState } from '@tanstack/react-table';
import { useFetchSubmissions } from '../api/api';
import { Submission } from '../types/validation';

export function useValidationTable() {
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

  return {
    submissions,
    isLoading,
    error,
    refetch,
    selectedRow,
    setSelectedRow,
    statusToUpdate,
    setStatusToUpdate,
    sorting,
    setSorting,
    pageIndex,
    setPageIndex,
    pageSize,
    setPageSize,
    globalFilter,
    setGlobalFilter,
    columnFilters,
    setColumnFilters,
    isUpdating,
    setIsUpdating,
    updateMessage,
    setUpdateMessage,
    showAlertGuide,
    setShowAlertGuide,
    sidebarOpen,
    setSidebarOpen,
  };
} 