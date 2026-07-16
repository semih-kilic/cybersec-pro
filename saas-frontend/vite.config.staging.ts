import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/dashboard/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/config': path.resolve(__dirname, './src/config'),
      '@/styles': path.resolve(__dirname, './src/styles'),
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    port: 3002,
    host: true,
    allowedHosts: ['cyber-sec-pro.com', 'www.cyber-sec-pro.com', 'app.cyber-sec-pro.com', 'staging.cyber-sec-pro.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:5003',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5003',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'static-v2',
    sourcemap: false,
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          motion: ['framer-motion'],
          query: ['@tanstack/react-query'],
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          charts: ['recharts'],
          ui: ['@headlessui/react', '@heroicons/react'],
          stripe: ['@stripe/stripe-js', '@stripe/react-stripe-js'],
          socket: ['socket.io-client'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
});

