import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8000,
    proxy: {
      '/api': {
        // In Docker, use container name; locally use localhost
        target: process.env.VITE_API_URL || 'http://sams-api:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => {
          // Health endpoint is at /health, not /api/health
          // Other endpoints are at /api/*
          if (path === '/api/health') {
            return '/health';
          }
          // Keep /api prefix for other routes
          return path;
        },
      },
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ['@supabase/supabase-js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
          lucide: ["lucide-react"],
        },
      },
      external: (id) => {
        // Ignore Supabase package during build
        return id === '@supabase/supabase-js' || id.startsWith('@supabase/');
      },
    },
  },
}));
