import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // HMR: use client-detected host/port so it works through any reverse proxy
    // (nginx, ngrok, etc.). The browser will connect the WebSocket to the same
    // origin the page was loaded from, and nginx routes /__vite_hmr back here.
    hmr: {
      clientPort: 443,   // ngrok free uses HTTPS (port 443)
      protocol: 'wss',   // match ngrok's HTTPS
    },
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/health': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
    // Allow connections from any host (ngrok subdomain)
    allowedHosts: true,
  },
});
