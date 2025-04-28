/// <reference types="vite/client" />

// Proper environment detection
const isProduction = import.meta.env.PROD;

// Base URL detection - this will work in both environments
export const getApiBaseUrl = () => {
  // In production (Vercel), use the environment variable or API proxy
  if (isProduction) {
    return import.meta.env.VITE_API_URL || '/api';
  }
  // In development, use localhost
  return 'http://localhost:3001/api';
}; 