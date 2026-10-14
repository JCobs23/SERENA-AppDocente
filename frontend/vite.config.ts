import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    proxy: {
      '/api': {
        target: 'https://localhost:5081',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/covers-manifest': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/covers': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
