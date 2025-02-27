import axios from 'axios';

// Replace with your actual API URL
const API_BASE_URL = 'http://localhost:3001/api';

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