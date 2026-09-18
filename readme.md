# Employee Work Tracker

[![CI](https://github.com/djpwrtch-hash/Administrative-Management/actions/workflows/ci.yml/badge.svg)](https://github.com/djpwrtch-hash/Administrative-Management/actions/workflows/ci.yml)

A production-grade full-stack workforce management application for small to medium teams (30-35 employees). Replaces manual spreadsheets with a centralized system for attendance, tasks, leaves, work plans, reports, and analytics.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express 4.x, TypeScript, mysql2 (raw SQL) |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| **Database** | MySQL 8.0 with InnoDB |
| **Auth** | JWT access + refresh tokens (httpOnly cookies), bcrypt (12 rounds) |
| **Real-time** | Socket.IO for live notifications |
| **Charts** | Recharts for analytics dashboards |
| **State** | TanStack React Query v5, Axios with interceptors |
| **Testing** | Vitest (frontend only) |
| **Deployment** | Docker, PM2, Nginx reverse proxy |

## Quick Start

### Prerequisites
- Node.js 20+
- npm 9+

### Setup

```bash
git clone https://github.com/djpwrtch-hash/Administrative-Management.git
cd Administrative-Management
npm install
cp server/.env.example server/.env
npm run dev
```

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:4000
- **Health Check:** http://localhost:4000/health
- **API Docs:** http://localhost:4000/api-docs



## Project Structure

```
employee-work-tracker/
├── server/                       # Backend API (Express + TypeScript)
│   ├── src/
│   │   ├── app.ts                # Express app setup
│   │   ├── server.ts             # Entry point with graceful shutdown
│   │   ├── middleware/           # Auth, RBAC, validation, compression, caching
│   │   ├── lib/                  # Config, JWT, time utils, auto-absent, socket, backup
│   │   ├── db/                   # MySQL connection, schema, migrations, setup
│   │   ├── modules/              # 15 feature modules (auth, attendance, tasks, etc.)
│   │   └── types/                # TypeScript type definitions
│   ├── tests/                    # Frontend Vitest tests
│   ├── load-tests/               # Artillery load tests
│   └── package.json
├── web/                          # Frontend (Next.js 15 + React 19)
│   ├── src/
│   │   ├── app/                  # 19 page routes (App Router)
│   │   ├── components/           # Shared UI components (ErrorBoundary, Toast, ConfirmDialog)
│   │   ├── context/              # AuthContext with JWT refresh
│   │   ├── lib/                  # API client, socket, utils, location
│   │   └── types/                # TypeScript interfaces for API responses
│   └── package.json
├── .github/workflows/ci.yml     # CI/CD pipeline
├── ecosystem.config.js           # PM2 process management
└── package.json                  # Root workspace config
```

## Features

### Core Modules (14 modules, ~80 API endpoints)

| Module | Description |
|--------|-------------|
| **Auth** | JWT login/register, refresh token rotation, password reset, account lockout |
| **Attendance** | Check-in/out, pause/resume, geolocation, auto-absent scheduler, overtime detection |
| **Tasks** | CRUD with assignments, comments, approvals, progress tracking, statistics |
| **Work Plans** | Daily planning with submission and manager review workflow |
| **Work Reports** | End-of-day reports with feedback and blockers tracking |
| **Leaves** | Application, approval, cancellation, balance tracking, working-day calculation |
| **Documents** | Employee requests for appointment letters, experience/internship/leaving certificates and salary slips; HR/Admin fill a boilerplate template and issue; auto-generated PDF/Word download with notifications |
| **Employee Database** | Admin/HR-only employee-wise master record: full profile data plus every official letter issued to each employee, with in-page issue workflow and PDF/Word downloads |
| **Departments** | CRUD with manager assignment, employee count |
| **Teams** | Team management with member add/remove, leader designation |
| **Users** | Full CRUD with role-based access, employee ID generation |
| **Holidays** | Company-wide and per-user holiday assignment |
| **Notifications** | Real-time via Socket.IO, mark-read, bulk operations |
| **Activity Logs** | Complete audit trail for all entity changes |
| **Analytics** | Attendance trends, department stats, leave usage, task summary |
| **System** | DB overview, WAL-safe backups, health/readiness probes |

### Security Features

- **JWT Rotation:** Access token (15min) in memory, refresh token (30d) in httpOnly cookie
- **RBAC:** Director, HR, Employee roles with per-endpoint enforcement
- **Rate Limiting:** Global, write, auth-specific limits with MySQL persistence
- **Account Lockout:** 5 failed attempts → 15-minute lockout
- **Password Reset:** One-time use tokens with 1-hour expiry
- **Circuit Breaker:** bcrypt failure protection
- **Security Headers:** Helmet (CSP, XSS, HSTS)
- **CORS:** Configurable origins with credentials
- **IDOR Prevention:** Users can only access their own data

### UI Features

- **Dark theme** with consistent design language
- **Responsive design** (mobile sidebar, flexible layouts)
- **Real-time updates** via Socket.IO
- **Toast notifications** for all operations
- **Custom confirmation dialogs** for destructive actions
- **CSV/Excel/PDF export** with column picker
- **Geolocation capture** on check-in
- **Calendar integration** for attendance and leaves
- **Advanced filtering** with date ranges and multi-select
- **Optimistic UI updates** for instant feedback

## Available Scripts

### Root

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both backend + frontend |
| `npm run build` | Production build |
| `npm start` | Production start |
| `npm run lint` | Lint both packages |
| `npm run typecheck` | Type check backend |
| `npm test` | Run frontend tests |
| `npm run db:seed` | Seed database |
| `npm run backup` | Manual backup |
| `npm run backup:list` | List backups |

### Backend (`server/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | TypeScript compilation |
| `npm test` | Frontend Vitest tests only (no backend tests) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |

### Frontend (`web/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

## API Authentication

```bash
# Login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123"}'

# Authenticated request
curl -X GET http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

## Testing

```bash
# Run all tests
npm test -w server

# Watch mode
npm run test:watch -w server

# Coverage
npm run test:coverage -w server

# Load tests (requires Artillery)
cd server
npx artillery run load-tests/auth-load-test.yml
```

## Deployment

### Docker

```bash
cd server
docker-compose up -d
```

### PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Nginx

See `deployment.md` for full Nginx reverse proxy configuration with SSL.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Environment mode |
| `PORT` | 4000 | API server port |
| `CORS_ORIGIN` | http://localhost:3000 | Allowed CORS origins |
| `DATABASE_PATH` | data.db | SQLite database file |
| `JWT_ACCESS_SECRET` | (auto-generated) | Access token signing key |
| `JWT_REFRESH_SECRET` | (auto-generated) | Refresh token signing key |
| `JWT_ACCESS_TTL` | 15m | Access token expiry |
| `JWT_REFRESH_TTL_DAYS` | 30 | Refresh token expiry (days) |
| `MAX_LOGIN_ATTEMPTS` | 5 | Lockout threshold |
| `LOCKOUT_MINUTES` | 15 | Lockout duration |
| `ENABLE_HTTPS` | false | Self-signed HTTPS |

## License

See `LICENSE` file.
