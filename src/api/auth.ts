import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiConfig';

const API_BASE_URL = getApiBaseUrl();

interface LoginResponse {
  success: boolean;
  user?: {
    username: string;
    role: string;
    name?: string;
    country?: string[];
  };
}

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, { username, password });
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    return { success: false };
  }
}; 