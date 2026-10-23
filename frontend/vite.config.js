import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser calls /api/... on the Vite server, which forwards it to the Express backend.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
});
