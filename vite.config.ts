import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['highcharts', 'highcharts-react-official'],
          table: ['@tanstack/react-table', '@tanstack/match-sorter-utils'],
          ui: ['@tabler/core', '@tabler/icons-react']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
}) 