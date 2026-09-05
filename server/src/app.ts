import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { compressMiddleware } from './middleware/compress';
import { requestTimeout } from './lib/timeout';
import { concurrencyLimiter } from './lib/concurrency-limiter';
import { auditLog } from './middleware/audit-log';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { config } from './lib/config';
import { RateLimitStore } from './lib/rate-limit-store';
import db from './db';
import { errorHandler } from './middleware/error-handler';
import { authenticate } from './middleware/authenticate';
import { requireRole } from './middleware/rbac';
import { swaggerSpec } from './swagger';
import swaggerUi from 'swagger-ui-express';

import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import departmentsRoutes from './modules/departments/departments.routes';
import teamsRoutes from './modules/teams/teams.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import tasksRoutes from './modules/tasks/tasks.routes';
import plansRoutes from './modules/plans/plans.routes';
import reportsRoutes from './modules/reports/reports.routes';
import leavesRoutes from './modules/leaves/leaves.routes';
import documentsRoutes from './modules/documents/documents.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import activityLogsRoutes from './modules/activity-logs/activity-logs.routes';
import holidaysRoutes from './modules/holidays/holidays.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import systemRoutes from './modules/system/system.routes';
import filesRoutes from './modules/files/files.routes';
import reportTemplatesRoutes from './modules/report-templates/report-templates.routes';
import scheduledReportsRoutes from './modules/scheduled-reports/scheduled-reports.routes';

// Clean up expired rate limit entries on startup
  RateLimitStore.resetExpired();

export function createApp() {
  const app = express();

  // Trust proxy hops when behind a reverse proxy (TRUST_PROXY env, e.g. "1" or "loopback")
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy === 'true') app.set('trust proxy', 1);
  else if (trustProxy && trustProxy !== 'false') app.set('trust proxy', Number(trustProxy) || trustProxy);

  // Request ID
  app.use((req, _res, next) => {
    (req as any).id = randomUUID();
    next();
  });

  // Timeout & concurrency protection
  app.use(requestTimeout());
  app.use(concurrencyLimiter());

  // Security
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    noSniff: true,
  }));

  // Permissions-Policy header
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
    next();
  });
  app.use(compressMiddleware());
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.nodeEnv === 'production' ? 500 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
    store: new RateLimitStore('global'),
  });
  const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.nodeEnv === 'production' ? 200 : 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many write requests, please slow down.' },
    store: new RateLimitStore('write'),
  });

  app.use(globalLimiter);
  // Parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  // Logging
  morgan.token('req-id', (req: any) => req.id?.slice(0, 8) || '-');
  app.use(morgan(config.nodeEnv === 'production' ? ':req-id :method :url :status :response-time ms' : 'dev'));
  
  // Health check
  app.get('/health', async (_req, res) => {
    try {
      const migr = await db.prepare('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1').get() as any;
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
        version: process.env.npm_package_version || '1.0.0',
        dbMigrationVersion: migr?.version ?? 0,
      });
    } catch {
      res.status(503).json({ status: 'error', timestamp: new Date().toISOString(), dbMigrationVersion: 0 });
    }
  });

  // Readiness probe - checks if database is accessible
  app.get('/ready', async (_req, res) => {
    try {
      await db.prepare('SELECT 1').get();
      res.json({ 
        status: 'ready', 
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ok',
          websocket: 'ok'
        }
      });
    } catch {
      res.status(503).json({ 
        status: 'not ready', 
        timestamp: new Date().toISOString(),
        error: 'Service dependencies not ready'
      });
    }
  });

  // Write limiter for state-changing methods
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return writeLimiter(req, res, next);
    }
    next();
  });

  // API routes
  const api = '/api/v1';
  app.use(`${api}/auth`, authRoutes);

  // Audit logging (applied to all API routes)
  app.use(`${api}`, auditLog());
  app.use(`${api}/users`, usersRoutes);
  app.use(`${api}/departments`, departmentsRoutes);
  app.use(`${api}/teams`, teamsRoutes);
  app.use(`${api}/attendance`, attendanceRoutes);
  app.use(`${api}/tasks`, tasksRoutes);
  app.use(`${api}/plans`, plansRoutes);
  app.use(`${api}/reports`, reportsRoutes);
  app.use(`${api}/leaves`, leavesRoutes);
  app.use(`${api}/documents`, documentsRoutes);
  app.use(`${api}/notifications`, notificationsRoutes);
  app.use(`${api}/activity-logs`, activityLogsRoutes);
  app.use(`${api}/holidays`, holidaysRoutes);
  app.use(`${api}/analytics`, analyticsRoutes);
  app.use(`${api}/system`, systemRoutes);
  app.use(`${api}/files`, filesRoutes);
  app.use(`${api}/report-templates`, reportTemplatesRoutes);
  app.use(`${api}/scheduled-reports`, scheduledReportsRoutes);

  // API docs - protected in production
  if (config.nodeEnv === 'production') {
    app.use('/api-docs', authenticate, requireRole('director'), swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  } else {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }

  // 404
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use(errorHandler);

  return app;
}
