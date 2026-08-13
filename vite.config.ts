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
          table: ['@tanstack/react-table'],
          // Match what `src/main.tsx` actually imports — a bare '@tabler/core' here never
          // matched anything, so Tabler's JS was silently folded into the main chunk.
          ui: ['@tabler/core/dist/js/tabler.min.js', '@tabler/icons-react']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
}) 