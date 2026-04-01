import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    watch: {
      ignored: ['**/참조/**'],
    },
  },
  optimizeDeps: {
    entries: ['src/**/*.{ts,tsx}', 'index.html'],
  },
})
