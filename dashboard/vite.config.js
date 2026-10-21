import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite Configuration for Knotiq Rugs Lead Scraper Dashboard
 *
 * During local development (Vite dev server on port 5173), all requests to /api and /health
 * are automatically proxied to the Express backend running on http://localhost:5000.
 *
 * You can override the proxy target by setting VITE_API_URL or VITE_BACKEND_URL in your environment.
 * In production deployments (e.g. Vercel), client requests directly use VITE_API_URL.
 */
export default defineConfig(({ mode }) => {
  // Load environment variables based on the active mode (development, production, etc.)
  const env = loadEnv(mode, process.cwd(), '');

  // Backend API URL defaults to http://localhost:5000
  const backendTarget = env.VITE_API_URL || env.VITE_BACKEND_URL || env.BACKEND_URL || 'http://localhost:5000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false
        },
        '/health': {
          target: backendTarget,
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});
