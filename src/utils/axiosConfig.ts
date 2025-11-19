import axios from 'axios';

// Add request interceptor to include JWT authentication token
axios.interceptors.request.use(
  (config) => {
    // Get JWT token from localStorage
    const token = localStorage.getItem('authToken');

    if (token) {
      // Add Authorization header with JWT token
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle authentication errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Check if it's a token expiry
      const errorCode = error.response?.data?.code;

      if (errorCode === 'TOKEN_EXPIRED') {
        console.warn('JWT token expired. Please log in again.');
      }

      // Clear authentication data and redirect to login on any 401 error
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default axios;
