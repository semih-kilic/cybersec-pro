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
        // Use a function for manualChunks to be compatible with newer Rollup/Rolldown
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react') || id.includes('react-dom')) return 'vendor';
          if (id.includes('react-router-dom')) return 'router';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('@tanstack/react-query')) return 'query';
          if (id.includes('i18next') || id.includes('react-i18next') || id.includes('i18next-browser-languagedetector')) return 'i18n';
          if (id.includes('recharts')) return 'charts';
          if (id.includes('@headlessui') || id.includes('@heroicons')) return 'ui';
          if (id.includes('@stripe/stripe-js') || id.includes('@stripe/react-stripe-js')) return 'stripe';
          if (id.includes('socket.io-client')) return 'socket';
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) return 'forms';
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
});
