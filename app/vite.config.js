import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev proxy target for the FastAPI backend; override with VITE_API_URL when
// the backend isn't on localhost:8000.
const apiTarget = process.env.VITE_API_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['node_modules/', 'src/test/', 'dist/'],
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true
      },
      '/books': {
        target: apiTarget,
        changeOrigin: true
      },
      '/audio': {
        target: apiTarget,
        changeOrigin: true
      }
    }
  }
})
