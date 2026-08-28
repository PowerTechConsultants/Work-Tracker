# Deployment Guide

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **npm** 9+
- **OpenSSL** (only if HTTPS is enabled)
- **Systemd** or **PM2** (for production process management)

## Production Build

### 1. Backend Build

```bash
cd server
npm install
npm run build
# Output: dist/ directory
```

### 2. Frontend Build

```bash
cd web
npm install
npm run build
# Output: .next/ directory
```

## Environment Configuration

Create `server/.env` for production:

```env
NODE_ENV=production
PORT=4000
CORS_ORIGIN=https://yourdomain.com
DATABASE_PATH=data.db
JWT_ACCESS_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
JWT_REFRESH_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL_DAYS=30
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_MINUTES=15
UPLOAD_DIR=uploads
ENABLE_HTTPS=false
```

> **Security:** Generate unique secrets for each deployment. Never reuse dev secrets in production.

## Deployment Options

### Option A: Bare Metal / VPS

#### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start backend
cd server
pm2 start dist/src/server.js --name employee-tracker-api

# Start frontend
cd web
pm2 start npm --name employee-tracker-web -- start

# Save PM2 process list
pm2 save
pm2 startup
```

#### Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/employee-tracker

server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Then enable SSL with Certbot:

```bash
sudo certbot --nginx -d yourdomain.com
```

### Option B: Docker

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    ports:
      - "4000:4000"
    volumes:
      - ./server/data.db:/app/data.db
      - ./server/uploads:/app/uploads
      - ./server/backup:/app/backup
    environment:
      NODE_ENV: production
      PORT: 4000
      CORS_ORIGIN: https://yourdomain.com
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
    restart: unless-stopped

  frontend:
    build:
      context: ./web
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: https://yourdomain.com/api
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend
    restart: unless-stopped
```

**Backend Dockerfile:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["node", "dist/src/server.js"]
```

**Frontend Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "start"]
```

## Database Management

### SQLite Considerations

- **Backup regularly:** The database is a single file (`data.db`)
- **WAL mode:** Enabled for concurrent read performance
- **Crash safety:** For production, add `PRAGMA synchronous = FULL` in `server/src/db/index.ts`

### Backup Script

```bash
# Manual backup (script included)
cd server
npm run backup

# Or using cron (daily at 2 AM)
0 2 * * * cd /path/to/server && npm run backup >> /var/log/backup.log 2>&1
```

Backups are stored in `server/backup/` with timestamped filenames.

### Restore

```bash
cd server
cp backup/employee-tracker-2026-07-24.db data.db
```

## HTTPS Setup

### Option 1: Terminate at Load Balancer / Reverse Proxy (Recommended)

Set `ENABLE_HTTPS=false` in `.env` and handle TLS at the Nginx/Caddy/Cloudflare level.

### Option 2: Self-Signed (Not for Production)

```env
ENABLE_HTTPS=true
```

On first run, the server generates self-signed certificates via OpenSSL. A browser security warning will appear.

### Option 3: Let's Encrypt with Nginx

Use Certbot for automated certificates. The Nginx config above works with Certbot's webroot or standalone mode.

## Monitoring

### Health Checks

- `GET /health` — Returns server status, uptime, environment
- `GET /ready` — Returns readiness probe (database + websocket status)

### Logging

- Morgan HTTP request logging (disabled in test mode, enabled otherwise)
- Error logging with stack traces (disabled in production for 500 errors)
- Auto-absent scheduler logs daily activity

### Application Monitoring

```bash
# PM2 monitoring
pm2 monit
pm2 logs employee-tracker-api

# Resource usage
pm2 show employee-tracker-api
```

## Performance Tuning

### SQLite

Add to `server/src/db/index.ts` for production:

```typescript
db.pragma('synchronous = FULL');    // Crash safety
db.pragma('cache_size = -64000');   // 64MB cache
db.pragma('busy_timeout = 5000');   // 5 second busy wait
```

### Rate Limiting

Current defaults (adjust in `server/src/app.ts`):
- Global: 500 requests per 15 minutes
- Auth: 10 requests per 15 minutes (skip successful)
- Write: 100 requests per 15 minutes

### Node.js

```bash
# Use cluster mode with PM2 for multi-core
pm2 start dist/src/server.js -i max --name employee-tracker-api
```

## Security Checklist

- [ ] JWT secrets regenerated (unique per deployment)
- [ ] `NODE_ENV=production`
- [ ] TLS/SSL configured
- [ ] CORS origin restricted to your domain
- [ ] Rate limiting enabled
- [ ] Database backups configured
- [ ] File upload directory permissions restricted
- [ ] Production .env file permissions: `chmod 600 .env`
- [ ] Default seed passwords changed
- [ ] OpenSSL installed (if HTTPS enabled)
- [ ] Firewall rules: only ports 80/443 (and 4000 if needed) open

## Troubleshooting

### Database locked errors
```
SQLITE_BUSY: database is locked
```
**Fix:** WAL mode is enabled by default. If persistent, check for long-running transactions. Restart the server.

### Port already in use
```
Error: listen EADDRINUSE :::4000
```
**Fix:** `kill $(lsof -t -i:4000)` or change PORT in .env.

### Permission denied on database
```
Error: unable to open database file
```
**Fix:** Ensure the `data.db` directory is writable by the Node.js process. `chown -R nodeuser:nodeuser /path/to/server`.

### Websocket connection failures
**Fix:** Ensure Nginx proxies `/socket.io/` with `Upgrade` and `Connection` headers (see Nginx config above).

### Auto-absent not running
**Fix:** Check that the server timezone is set correctly. The scheduler triggers at 6:30 PM IST regardless of server timezone. Verify with logs: `journalctl -u employee-tracker | grep Auto-Absent`.
