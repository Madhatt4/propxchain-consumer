// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

import { DEV_SECURITY_HEADERS } from './config/security-headers.mjs'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/', // Use absolute paths for ICP deployment
  plugins: [react()],
  publicDir: 'public', // Serve public assets (videos excluded via .dfxignore)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@wizard': path.resolve(__dirname, './src/wizard'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@types': path.resolve(__dirname, './src/types'),
      '@logic': path.resolve(__dirname, './src/logic'),
      '@data': path.resolve(__dirname, './src/data'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 400,
    sourcemap: false, // Disable sourcemaps to reduce memory usage
    minify: 'esbuild', // Use esbuild instead of terser (faster, less memory)
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React core
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          // DFINITY/ICP
          if (id.includes('node_modules/@dfinity/')) {
            return 'dfinity-vendor';
          }
          // Radix UI components
          if (id.includes('node_modules/@radix-ui/')) {
            return 'ui-vendor';
          }
          // Large libraries - separate chunks
          if (id.includes('node_modules/jspdf')) {
            return 'jspdf';
          }
          if (id.includes('node_modules/html2canvas')) {
            return 'html2canvas';
          }
          if (id.includes('node_modules/qrcode')) {
            return 'qrcode';
          }
          // Lucide icons
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }
          // Framer motion
          if (id.includes('node_modules/framer-motion')) {
            return 'framer';
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: false, // Allow Vite to use next available port if 3000 is taken
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    headers: DEV_SECURITY_HEADERS,
  },
})
