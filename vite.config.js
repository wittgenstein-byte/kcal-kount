import { defineConfig } from 'vite';
import aiApiProxy from './vite-plugin-ai-proxy.js';

export default defineConfig({
  plugins: [aiApiProxy()],
  server: {
    allowedHosts: true,
    proxy: {
      '/api/images': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'es2020',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            const normalized = id.replace(/\\/g, '/');
            const parts = normalized.split('node_modules/')[1].split('/');
            return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
          }
        }
      }
    }
  }
});
