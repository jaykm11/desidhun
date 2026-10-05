import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/s': process.env.API_PROXY_TARGET ?? 'http://localhost:8080',
    },
  },
})
