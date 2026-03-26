import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),  // landing page
        app:  path.resolve(__dirname, 'app.html'),    // React SPA
      },
    },
  },
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  server: {
    // Proxy backend routes to the local FastAPI server when VITE_EXPORT_API_BASE
    // is not set (i.e. plain `npm run dev` without a .env override).
    proxy: {
      '/export-pdf': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
    fs: {
      allow: ['..'],
    },
  },
})
