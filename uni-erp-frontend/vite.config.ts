import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Dev: forward /api to the Express backend so the frontend never hardcodes a host
    proxy: { '/api': 'http://localhost:5000', '/uploads': 'http://localhost:5000' },
  },
})
