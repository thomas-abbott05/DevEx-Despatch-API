import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:80';

  return {
    root: 'src/frontend',
    envDir: '.',
    plugins: [react()],
    build: {
      outDir: '../../dist',
      emptyOutDir: true,
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
