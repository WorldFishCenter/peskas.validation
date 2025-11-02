import axios from 'axios';

// Add request interceptor to include authentication token
axios.interceptors.request.use(
  (config) => {
    // Get user from localStorage
    const userStr = localStorage.getItem('user');

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        // Add Authorization header with username as token
        // Backend uses username as a simple auth token
        config.headers.Authorization = `Bearer ${user.username}`;
      } catch (error) {
        console.error('Failed to parse user from localStorage:', error);
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle 401 errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear localStorage and redirect to login on 401
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default axios;
