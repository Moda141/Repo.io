/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'node:path';

/**
 * Repo.io UI — Vite config.
 *
 * - Dev server on 3000; API calls to /api/* are proxied to the Dropwizard
 *   backend (repoio-service) on 8585.
 * - SWC for fast React compile.
 * - SVGs can be imported as React components via vite-plugin-svgr.
 * - tsconfig path aliases (@/...) resolved automatically.
 */
export default defineConfig({
  plugins: [react(), svgr(), tsconfigPaths()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8585',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:8585',
        ws: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    outDir: 'build',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd', '@ant-design/icons'],
          query: ['@tanstack/react-query', '@tanstack/react-query-devtools'],
          charts: ['echarts', 'echarts-for-react'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
