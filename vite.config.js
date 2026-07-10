import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During dev, the API runs on :8787 and Vite on :5173.
// Proxy /api to the Express server so the frontend code is identical in dev and prod.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    outDir: 'dist',
  },
})
