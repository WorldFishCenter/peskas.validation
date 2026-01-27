import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiConfig';

const API_BASE_URL = getApiBaseUrl();

interface LoginResponse {
  success: boolean;
  token?: string;
  user?: {
    username: string;
    role: string;
    name?: string;
    country?: string[];
    language?: string;
  };
  expiresIn?: string;
  error?: string;
}

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, { username, password });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        return { success: false, error: 'Invalid username or password' };
      }
      if (error.code === 'ERR_NETWORK' || !error.response) {
        return { success: false, error: 'Unable to connect to server. Please check your connection.' };
      }
      return { success: false, error: error.response?.data?.error || 'Login failed. Please try again.' };
    }
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
};

/**
 * Request a password reset email
 * @param identifier - Username or email address
 */
export const requestPasswordReset = async (identifier: string): Promise<void> => {
  try {
    await axios.post(`${API_BASE_URL}/auth/forgot-password`, { identifier });
  } catch (error: any) {
    if (error.response?.status === 429) {
      throw new Error(error.response.data.error || 'Too many requests');
    }
    throw new Error(error.response?.data?.error || 'Failed to send reset email');
  }
};

/**
 * Validate a password reset token
 * @param token - Reset token from email link
 * @returns Object with validation result
 */
export const validateResetToken = async (token: string): Promise<{
  valid: boolean;
  username?: string;
  reason?: string;
}> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/validate-reset-token`, {
      params: { token }
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to validate token');
  }
};

/**
 * Reset password using a valid token
 * @param token - Reset token from email link
 * @param newPassword - New password
 * @param confirmPassword - Password confirmation
 */
export const resetPassword = async (
  token: string,
  newPassword: string,
  confirmPassword: string
): Promise<void> => {
  try {
    await axios.post(`${API_BASE_URL}/auth/reset-password`, {
      token,
      newPassword,
      confirmPassword
    });
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to reset password');
  }
};
