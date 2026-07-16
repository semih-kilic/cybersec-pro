import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/dashboard/',  // SaaS app is served from /dashboard/ path
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
    port: 3000,
    host: true,
    allowedHosts: ['cyber-sec-pro.com', 'www.cyber-sec-pro.com', 'app.cyber-sec-pro.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // CF edge cache poisoned old "/assets/" path with HTML 404 fallback.
    // Bumping assetsDir invalidates all asset URLs at the CDN layer.
    assetsDir: 'static-v2',
    sourcemap: false, // V17: disabled for production security
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — cached long-term
          vendor: ['react', 'react-dom'],
          // Routing — loaded on first navigation
          router: ['react-router-dom'],
          // Animation — only pages using motion
          motion: ['framer-motion'],
          // Data layer
          query: ['@tanstack/react-query'],
          // i18n bundle — loaded once
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          // Charts — only loaded by analytics-heavy pages
          charts: ['recharts'],
          // UI primitives — headless UI + heroicons
          ui: ['@headlessui/react', '@heroicons/react'],
          // Payments — only loaded by UpgradePage/BillingPage
          stripe: ['@stripe/stripe-js', '@stripe/react-stripe-js'],
          // Real-time
          socket: ['socket.io-client'],
          // Forms & validation
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
});
