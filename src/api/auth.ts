import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiConfig';

// Replace with your actual API URL
const API_BASE_URL = getApiBaseUrl();

// In a real app, this would make an actual API call
export const login = async (username: string, password: string): Promise<boolean> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, { username, password });
    return response.data.success;
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
}; 