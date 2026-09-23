import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const certKey = path.resolve(import.meta.dirname, 'certs/key.pem');
const certCrt = path.join(path.dirname(certKey), 'cert.pem');
// LAN HTTPS (geolocation needs a secure context): enabled automatically
// once `npm run dev:https` has generated certs/ (gitignored).
const httpsOptions =
  fs.existsSync(certKey) && fs.existsSync(certCrt)
    ? { key: fs.readFileSync(certKey), cert: fs.readFileSync(certCrt) }
    : undefined;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    // Keep 'out' so server static-serve, packager and FTP deploy keep working.
    outDir: 'out',
    chunkSizeWarningLimit: 1600,
  },
  server: {
    port: 3000,
    https: httpsOptions,
    // Local dev parity with the old Next.js rewrites: forward API + socket
    // traffic to the Express server. VITE_API_PORT overrides the target port
    // (E2E uses 4001 to avoid clashing with other local services on 4000).
    // Production static hosting calls the absolute VITE_API_URL instead.
    proxy: {
      '/api': `http://localhost:${process.env.VITE_API_PORT || '4001'}`,
      '/socket.io': { target: `ws://localhost:${process.env.VITE_API_PORT || '4001'}`, ws: true },
    },
  },
});
