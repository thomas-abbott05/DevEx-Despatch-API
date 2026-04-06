import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:80';
  const isProductionBuild = mode === 'production';

  return {
    root: 'src/frontend',
    publicDir: path.resolve(__dirname, 'public'),
    envDir: '.',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/frontend')
      }
    },
    build: {
      outDir: '../../dist',
      emptyOutDir: true,
    },
    define: isProductionBuild
      ? {
          'process.env.NODE_ENV': '"production"'
        }
      : {},
    esbuild: {
      jsxDev: !isProductionBuild
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/api-docs': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
