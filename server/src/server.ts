import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const here = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();

// Resolve DB path BEFORE any module that calls db/index.js.
// Use an absolute path inside the project so rebuilds never wipe data.
if (!process.env.SQLITE_PATH && !process.env.DATABASE_PATH) {
  process.env.SQLITE_PATH = path.join(cwd, 'data.db');
}

function minimalApp(): express.Express {
  const app = express();
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
  });
  app.get('/ready', async (_req, res) => {
    res.json({ status: 'degraded', timestamp: new Date().toISOString() });
  });
  return app;
}

async function startRealApp(): Promise<express.Express> {
  const { createApp } = await import('./app.js');
  return createApp();
}

async function main() {
  let app: express.Express;
  try {
    app = await startRealApp();
  } catch (e: any) {
    console.error('[STARTUP] createApp failed, using minimal app:', e?.message ?? e);
    app = minimalApp();
  }

  const enableHttps = process.env.ENABLE_HTTPS === 'true';
  let server: http.Server | https.Server;
  if (enableHttps) {
    const certDir = path.join(cwd, 'certs');
    const keyPath = path.join(certDir, 'key.pem');
    const certPath = path.join(certDir, 'cert.pem');
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      server = https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, app);
    } else {
      server = http.createServer(app);
    }
  } else {
    server = http.createServer(app);
  }

  const port = Number(process.env.API_PORT || process.env.PORT || 4001);
  server.on('error', (err: any) => {
    if (err?.code === 'EADDRINUSE') {
      console.error(`[SERVER] Port ${port} is already in use`);
    }
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`[SERVER] Running on http://0.0.0.0:${port}`);
    console.log(`[ENV] ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful startup: fire-and-forget background jobs, never block the port.
  (async () => {
    try {
      const { ensureAdminBootstrap } = await import('./db/bootstrap.js');
      try { await ensureAdminBootstrap(); } catch (e: any) {
        console.warn('[SETUP] Admin bootstrap skipped:', e?.message ?? e);
      }
    } catch {}
    try {
      const { cleanupExpiredBlacklistEntries } = await import('./lib/blacklist.js');
      cleanupExpiredBlacklistEntries().catch(() => {});
    } catch {}
    try {
      const { runAnnualLeaveReset } = await import('./lib/leave-reset.js');
      runAnnualLeaveReset().catch((e: any) => console.error('[Leave-Reset] Startup error:', e));
    } catch {}
    try {
      const { startAutoAbsentScheduler, stopAutoAbsentScheduler } = await import('./lib/auto-absent.js');
      startAutoAbsentScheduler();
      const cleanupTimer = setInterval(async () => {
        try { await (await import('./db/index.js')).default.prepare("DELETE FROM token_blacklist WHERE expires_at <= NOW()").run(); } catch {}
        try { await (await import('./db/index.js')).default.prepare("DELETE FROM rate_limits WHERE expires_at <= NOW()").run(); } catch {}
        try { await (await import('./db/index.js')).default.prepare("DELETE FROM refresh_tokens WHERE expires_at <= NOW()").run(); } catch {}
        try { await (await import('./db/index.js')).default.prepare("DELETE FROM api_cache WHERE expires_at <= NOW()").run(); } catch {}
      }, 60 * 60 * 1000);
      const overtimeTimer = setInterval(async () => {
        try {
          const { default: db } = await import('./db/index.js');
          const { AttendanceService } = await import('./modules/attendance/attendance.service.js');
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
              await AttendanceService.recalculateAllOvertime(year, month);
              await db.prepare("INSERT INTO app_settings (`key`, value, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()").run('monthly_overtime_last_calc', calcKey);
            }
          }
        } catch {}
      }, 60 * 1000);
      setTimeout(() => { clearInterval(cleanupTimer); clearInterval(overtimeTimer); }, 30 * 60 * 1000);
    } catch {}
    try {
      const { initializeSocket } = await import('./lib/socket.js');
      initializeSocket(server);
    } catch {}
  })().catch(() => {});
}

process.on('uncaughtException', (error) => {
  console.error('[ERROR] Uncaught Exception:', error);
  console.error('[ERROR] Keeping process alive for health checks...');
  setTimeout(() => { console.error('[ERROR] Forced exit after uncaught exception'); process.exit(1); }, 30000);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
});

main().catch((e) => {
  console.error('[STARTUP] Fatal:', e?.message ?? e);
});
