import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built artifacts are served by the FastAPI app in production, so the dev
// server only needs to proxy /api to the local backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
