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
