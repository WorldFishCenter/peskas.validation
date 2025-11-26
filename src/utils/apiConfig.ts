/// <reference types="vite/client" />

/**
 * Get API base URL based on environment
 *
 * Vercel best practice: Always use VITE_API_URL if set, otherwise fallback to mode detection
 * This ensures consistent behavior across all Vercel environments (preview, production)
 */
export const getApiBaseUrl = () => {
  // If VITE_API_URL is explicitly set, use it (production/preview on Vercel)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Otherwise, detect mode (local development)
  if (import.meta.env.DEV) {
    return 'http://localhost:3001/api';
  }

  // Final fallback for production builds without VITE_API_URL
  return '/api';
}; 