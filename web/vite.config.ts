import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, las llamadas a /api se envían a la API local.
// Si usas Docker para la API, arranca con:  $env:API_URL="http://localhost:8080"; npm run dev
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Sistem_-management_DRFC/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // permite abrirla desde el celular en la misma red
    proxy: { '/api': { target: process.env.API_URL || 'http://localhost:3000', changeOrigin: true } },
  },
});
