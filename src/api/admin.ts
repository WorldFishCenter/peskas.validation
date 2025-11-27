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
