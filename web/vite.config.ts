import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Only share-page routes (/s/<id>); must not catch /src/* dev modules.
      '^/s/.*': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
