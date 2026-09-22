import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { createApp } from './app.js';
import { config } from './lib/config.js';
import { initializeSocket, closeSocket } from './lib/socket.js';
import { startAutoAbsentScheduler, stopAutoAbsentScheduler } from './lib/auto-absent.js';
import { runAnnualLeaveReset } from './lib/leave-reset.js';
import { cleanupExpiredBlacklistEntries } from './lib/blacklist.js';
import { ensureAdminBootstrap } from './db/bootstrap.js';
import db, { pool } from './db/index.js';
import { AttendanceService } from './modules/attendance/attendance.service.js';

try {
  await ensureAdminBootstrap();
} catch (e) {
  console.warn('[SETUP] Admin bootstrap skipped (DB not ready, will retry on next health check):', (e as any)?.message ?? e);
}

cleanupExpiredBlacklistEntries().catch(() => {});
runAnnualLeaveReset().catch(e => console.error('[Leave-Reset] Startup error:', e));

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
      const cert = await import('./lib/cert.js');
      cert.generateSelfSignedCert(certDir);
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
const cleanupTimer = setInterval(async () => {
  try { await db.prepare("DELETE FROM token_blacklist WHERE expires_at <= NOW()").run(); } catch (e) { console.error('[Cleanup] token_blacklist:', e); }
  try { await db.prepare("DELETE FROM rate_limits WHERE expires_at <= NOW()").run(); } catch (e) { console.error('[Cleanup] rate_limits:', e); }
  try { await db.prepare("DELETE FROM refresh_tokens WHERE expires_at <= NOW()").run(); } catch (e) { console.error('[Cleanup] refresh_tokens:', e); }
  try { await db.prepare("DELETE FROM api_cache WHERE expires_at <= NOW()").run(); } catch (e) { console.error('[Cleanup] api_cache:', e); }
}, 60 * 60 * 1000);

const overtimeTimer = setInterval(async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  const isLastDay = now.getDate() === lastDay;
  const isNearMidnight = now.getHours() === 23 && now.getMinutes() >= 55;
  if (isLastDay && isNearMidnight) {
    const lastCalc = await db.prepare("SELECT value FROM app_settings WHERE `key` = 'monthly_overtime_last_calc'").get() as any;
    const calcKey = `${year}-${month}`;
    if (lastCalc?.value !== calcKey) {
      console.log(`[Overtime] Running monthly overtime calculation for ${year}-${month}`);
      try {
        await AttendanceService.recalculateAllOvertime(year, month);
        await db.prepare("INSERT INTO app_settings (`key`, value, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()").run('monthly_overtime_last_calc', calcKey);
        console.log(`[Overtime] Completed for ${year}-${month}`);
      } catch (e) { console.error('[Overtime] Calculation error:', e); }
    }
  }
}, 60 * 1000);

const port = config.port;
server.on('error', (err: any) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(`[SERVER] Port ${port} is already in use (0.0.0.0:${port}).`);
    console.error(`[SERVER] Fix: free the port or run with an alternate port:`);
    console.error(`[SERVER]   PowerShell: $env:API_PORT=4001; $env:VITE_API_PORT=4001; npm run dev`);
    console.error(`[SERVER]   Bash: API_PORT=4001 VITE_API_PORT=4001 npm run dev`);
    console.error(`[SERVER]   Or permanently set API_PORT=4001 and VITE_API_PORT=4001 in server/.env and web/.env`);
  }
});
server.listen(port, '0.0.0.0', () => {
  console.log(`[SERVER] Running on http${enableHttps ? 's' : ''}://0.0.0.0:${port}`);
  console.log(`[SERVER] Access via your local IP address`);
  console.log(`[ENV] ${config.nodeEnv}`);
});

let shuttingDown = false;
const gracefulShutdown = async (signal: string, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[SHUTDOWN] ${signal} received. Starting graceful shutdown...`);
  stopAutoAbsentScheduler();
  closeSocket();
  console.log('[SHUTDOWN] Socket.IO server closed');
  clearInterval(cleanupTimer);
  clearInterval(overtimeTimer);
  server.close(async () => {
    console.log('[SHUTDOWN] HTTP server closed');
    try { await pool.end(); } catch (e) { console.error('[Shutdown] Pool close error:', e); }
    process.exit(exitCode);
  });
  setTimeout(() => {
    console.log('[SHUTDOWN] Forced exit after timeout');
    process.exit(exitCode);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  console.error('[ERROR] Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION', 1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION', 1);
});
