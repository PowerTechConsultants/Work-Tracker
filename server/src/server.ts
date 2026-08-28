import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { createApp } from './app';
import { config } from './lib/config';
import { initializeSocket, closeSocket } from './lib/socket';
import { startAutoAbsentScheduler } from './lib/auto-absent';
import { cleanupExpiredBlacklistEntries } from './lib/blacklist';
import { ensureAdminBootstrap } from './db/bootstrap';
import db from './db';

ensureAdminBootstrap();

cleanupExpiredBlacklistEntries();

const app = createApp();

const enableHttps = process.env.ENABLE_HTTPS === 'true';
let server: http.Server | https.Server;

if (enableHttps) {
  const certDir = path.join(process.cwd(), 'certs');
  let keyPath = path.join(certDir, 'key.pem');
  let certPath = path.join(certDir, 'cert.pem');

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });
    try {
      require('./lib/cert').generateSelfSignedCert(certDir);
    } catch (e) {
      console.warn('[SERVER] Failed to generate SSL certificate:', e);
      console.warn('[SERVER] Falling back to HTTP. Set ENABLE_HTTPS=false or generate certs manually in certs/');
      process.exit(1);
    }
  }

  server = https.createServer({
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  }, app);

  console.log(`[SERVER] HTTPS enabled`);
} else {
  server = http.createServer(app);
}

initializeSocket(server);
startAutoAbsentScheduler();
setInterval(() => {
  try {
    db.prepare("DELETE FROM token_blacklist WHERE expires_at <= datetime('now')").run();
    db.prepare("DELETE FROM rate_limits WHERE expires_at <= datetime('now')").run();
    db.prepare("DELETE FROM refresh_tokens WHERE expires_at <= datetime('now')").run();
    db.prepare("DELETE FROM api_cache WHERE expires_at <= datetime('now')").run();
  } catch {}
}, 60 * 60 * 1000);

const port = config.port;
server.listen(port, '0.0.0.0', () => {
  console.log(`[SERVER] Running on http${enableHttps ? 's' : ''}://0.0.0.0:${port}`);
  console.log(`[SERVER] Access via your local IP address`);
  console.log(`[ENV] ${config.nodeEnv}`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\n[SHUTDOWN] ${signal} received. Starting graceful shutdown...`);
  closeSocket();
  console.log('[SHUTDOWN] Socket.IO server closed');
  try {
    if (db) {
      try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch {}
      db.close();
      console.log('[SHUTDOWN] Database connection closed');
    }
  } catch (_error) {
    console.error('[SHUTDOWN] Error closing database:', _error);
  }
  console.log('[SHUTDOWN] Graceful shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  console.error('[ERROR] Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});
