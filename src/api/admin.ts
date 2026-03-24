import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiConfig';

const API_BASE_URL = getApiBaseUrl();

export interface User {
  _id: string;
  username: string;
  name?: string;
  country?: string[];
  role: 'admin' | 'user';
  permissions?: {
    surveys?: string[];
    enumerators?: string[];
  };
  created_at?: string;
}

export interface Survey {
  _id: string;
  asset_id: string;
  name: string;
  country_id: string;
  active: boolean;
  kobo_config?: {
    api_url: string;
    token: string;
  };
}

export interface CreateUserPayload {
  username: string;
  password: string;
  name?: string;
  country?: string[];
  role: 'admin' | 'user';
  permissions?: {
    surveys?: string[];
    enumerators?: string[];
  };
}

export interface UpdateUserPayload {
  name?: string;
  country?: string[];
  role?: 'admin' | 'user';
  permissions?: {
    surveys?: string[];
    enumerators?: string[];
  };
}

// Hook to fetch all users
export const useFetchUsers = () => {
  const [data, setData] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/users`);
      setData(response.data.users || []); // Extract users array from response
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.response?.data?.error || 'Failed to load users');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
};

// Hook to fetch all surveys
export const useFetchSurveys = () => {
  const [data, setData] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/surveys`);
      // API returns { success: true, surveys: [...] }
      setData(response.data.surveys || []);
    } catch (err: any) {
      console.error('Error fetching surveys:', err);
      setError(err.response?.data?.error || 'Failed to load surveys');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
};

// Create a new user
export const createUser = async (userData: CreateUserPayload): Promise<{ success: boolean; message: string; user?: User }> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/users`, userData);

    return {
      success: true,
      message: response.data.message || 'User created successfully',
      user: response.data.user
    };
  } catch (error: any) {
    console.error('Error creating user:', error);
    return {
      success: false,
      message: error.response?.data?.error || 'Failed to create user'
    };
  }
};

// Update an existing user
export const updateUser = async (userId: string, updates: UpdateUserPayload): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await axios.patch(`${API_BASE_URL}/users/${userId}`, updates);

    return {
      success: true,
      message: response.data.message || 'User updated successfully'
    };
  } catch (error: any) {
    console.error('Error updating user:', error);
    return {
      success: false,
      message: error.response?.data?.error || 'Failed to update user'
    };
  }
};

// Delete a user
export const deleteUser = async (userId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/users/${userId}`);

    return {
      success: true,
      message: response.data.message || 'User deleted successfully'
    };
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return {
      success: false,
      message: error.response?.data?.error || 'Failed to delete user'
    };
  }
};

// Update user permissions (assign surveys)
export const updateUserPermissions = async (
  userId: string,
  surveyIds: string[]
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await axios.patch(`${API_BASE_URL}/users/${userId}/permissions`, {
      surveys: surveyIds
    });

    return {
      success: true,
      message: response.data.message || 'Permissions updated successfully'
    };
  } catch (error: any) {
    console.error('Error updating permissions:', error);
    return {
      success: false,
      message: error.response?.data?.error || 'Failed to update permissions'
    };
  }
};

export interface AuditLog {
  _id: string;
  timestamp: string;
  username: string | null;
  user_id: string | null;
  category: 'auth' | 'validation' | 'download';
  action: string;
  status: 'success' | 'failure';
  details: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
}

export interface AuditLogsFilters {
  page?: number;
  limit?: number;
  username?: string;
  category?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Hook to fetch audit logs (admin only)
export const useFetchAuditLogs = (filters: AuditLogsFilters = {}) => {
  const [data, setData] = useState<{ logs: AuditLog[]; total: number }>({ logs: [], total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.username) params.set('username', filters.username);
      if (filters.category) params.set('category', filters.category);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

      const response = await axios.get(`${API_BASE_URL}/admin/audit-logs?${params.toString()}`);
      setData({ logs: response.data.logs || [], total: response.data.total || 0 });
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
      setError(err.response?.data?.error || 'Failed to load audit logs');
      setData({ logs: [], total: 0 });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- object identity: individual filter primitives listed explicitly to avoid re-renders on every call
  }, [filters.page, filters.limit, filters.username, filters.category, filters.from, filters.to, filters.sortBy, filters.sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
};

// Get accessible surveys for a user
export const getUserAccessibleSurveys = async (userId: string): Promise<{ success: boolean; surveys?: Survey[]; message?: string }> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/users/${userId}/accessible-surveys`);

    return {
      success: true,
      surveys: response.data.surveys
    };
  } catch (error: any) {
    console.error('Error fetching accessible surveys:', error);
    return {
      success: false,
      message: error.response?.data?.error || 'Failed to fetch accessible surveys'
    };
  }
};
