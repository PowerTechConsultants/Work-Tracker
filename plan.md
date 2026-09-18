# Employee Work Tracker - Project Plan

## Project Overview

**Employee Work Tracker** is a full-stack workforce management application built for small to medium teams (30-35 employees). It replaces manual spreadsheets with a centralized system for attendance, tasks, leaves, work plans, reports, and analytics.

**Status**: MVP in development - core workflows implemented, quality gates passing, manual end-to-end browser test remaining.

**Technologies**:
- **Backend**: Node.js, Express, TypeScript, mysql2, Socket.IO, JWT auth, bcrypt
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, Recharts, TanStack React Query, Axios
- **Database**: MySQL 8.0 with InnoDB - external DB server required
- **Auth**: JWT access token (in-memory) + refresh token (httpOnly cookie), RBAC (director/hr/employee)

---

## Project Structure

```
employee-work-tracker/
├── package.json                  ← Root workspace config
├── server/                       ← Node/Express Backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── ecosystem.config.js
│   ├── .env
│   ├── .env.example
│   ├── src/
│   │   ├── app.ts                ← Express app setup
│   │   ├── server.ts             ← Entry point
│   │   ├── middleware/           ← Auth, RBAC, validation, error handler
│   │   ├── lib/                  ← Config, JWT, time utils, auto-absent, socket
│   │   ├── db/                   ← MySQL connection, migrations, setup
│   │   ├── modules/              ← Feature modules (auth, attendance, tasks, etc.)
│   │   ├── types/                ← Type definitions
│   │   └── swagger.ts            ← API documentation
│   ├── backup/                   ← Timestamped DB backup files
│   ├── dist/                       ← Compiled output
│   └── .env                        ← MySQL configuration
├── web/                          ← Next.js Frontend
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── .next/                      ← Build cache
│   └── src/
│       ├── app/                    ← Next.js pages (19 routes)
│       ├── components/             ← Shared UI components
│       ├── context/                ← AuthContext
│       └── lib/                    ← API client, utils, socket
├── anchored-summary.md           ← Change log for recent fixes
├── README.md                     ← Project overview & quick start
├── project.md                    ← High-level overview & tech stack
├── TODO.md                       ← Quality-gate status & remaining work
├── MVP_TODO.md                   ← MVP completion checklist
├── MVP_FUTURE_PLAN.md            ← Post-MVP roadmap
├── UPDATE.md                     ← Incremental update log
├── use.md                        ← Usage guidelines
└── dev-err.log / dev-out.log     ← Development logs
```

---

## Technology Stack Details

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Language** | TypeScript | End-to-end type safety |
| **Backend** | Node.js + Express | REST API server |
| **ORM/Query** | mysql2 | Raw SQL for MySQL |
| **Database** | MySQL 8.0 | External DB server |
| **Auth** | JWT + bcrypt | Access token (memory) + refresh token (httpOnly cookie) |
| **Real-time** | Socket.IO | Notifications & real-time updates |
| **Frontend** | Next.js 15 + React 19 | App Router, server components |
| **Styling** | Tailwind CSS 4 | Utility-first, dark theme |
| **Charts** | Recharts | Analytics dashboards |
| **HTTP Client** | Axios | API calls with interceptors |
| **State Query** | TanStack React Query | Data fetching & caching |
| **Icons** | Lucide React | UI icons |
| **Build** | tsc, next build | TypeScript compilation, Next.js production build |
| **Lint** | ESLint | Code quality |
| **Package Manager** | npm | Dependency management |

---

## Development Phases

### Phase 1: Foundation (Completed)
- Project scaffolding with Express + Next.js
- MySQL schema design with InnoDB
- JWT authentication with httpOnly cookie rotation
- RBAC middleware (director/hr/employee)
- Rate limiting, CORS, Helmet security headers
- Error handling middleware

### Phase 2: Core Features (Completed)
- Attendance module with state machine (check-in → pause → resume → check-out)
- Auto-detection of half-day (<4 hours) and overtime (>8 hours)
- Auto-absent scheduler (daily 6:30 PM IST, skips weekends/holidays)
- Attendance override on check-in (converts absent/leave/holiday → present)
- Leave application with approval workflow
- Leave → attendance integration (approved leaves auto-create records)
- Department CRUD with manager assignment

### Phase 3: Task Management (Completed)
- Task CRUD with priority, status, progress
- Task assignment to multiple users
- Comments with author names
- Approval workflow (request → approve/reject)
- Task statistics and filtering

### Phase 4: Work Planning & Reporting (Completed)
- Daily work plans with planned work, priority, estimated hours
- Plan submission and manager review
- End-of-day reports with completed work, blockers, tomorrow's plan
- Report submission and feedback workflow

### Phase 5: Analytics & Dashboard (Completed)
- Attendance trends (monthly charts)
- Department statistics (headcount, attendance rates)
- Leave usage analytics (yearly)
- Task completion summary
- Recharts-based frontend dashboards

### Phase 6: Security Hardening (In Progress)
- IDOR prevention (users can only access own data)
- Self-approval prevention for leaves/tasks
- Stale JWT role re-fetch from database on every request
- Refresh token rotation with revocation tracking
- Password reset token (one-time use, 1-hour expiry)
- Account lockout after failed attempts
- CSV injection prevention
- XSS protection (refresh token in httpOnly cookie, not localStorage)
- Rate limiting (global 500/15min, auth 10/15min, write 100/15min)

### Phase 7: Testing & Polish (In Progress)
- 60+ backend tests across multiple suites
- Frontend build clean (19 pages)
- Dark theme responsive UI
- Database backup functionality

---

## Database Schema (16 Tables)

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| **users** | id, name, email, password, role, status, login_locked_until, last_login, created_at | Employee records with roles and lockout |
| **departments** | id, name, manager_id, created_at | Department hierarchy |
| **team_members** | user_id, team_name | User-team membership |
| **refresh_tokens** | token, user_id, expires_at, revoked | JWT refresh token storage |
| **attendance** | id, user_id, date, check_in, check_out, pause_time, status, working_hours, overtime, created_at | Daily attendance records |
| **tasks** | id, title, description, priority, status, estimated_hours, created_at | Work tasks |
| **task_assignments** | task_id, user_id | Many-to-many task-user assignments |
| **task_comments** | id, task_id, user_id, comment, created_at | Task discussion |
| **task_attachments** | id, task_id, filename, path, created_at | File attachments on tasks |
| **task_approvals** | id, task_id, status, approved_by, created_at | Task approval workflow |
| **work_plans** | id, user_id, date, planned_work, priority, estimated_hours, created_at | Daily work plans |
| **work_reports** | id, user_id, date, completed_work, blockers, tomorrow_plan, created_at | End-of-day reports |
| **leaves** | id, user_id, type, start_date, end_date, status, approved_by, created_at | Leave applications |
| **holidays** | id, date, name, type | Company holidays |
| **holiday_assignees** | holiday_id, user_id | Per-user holiday mapping |
| **notifications** | id, user_id, type, title, message, read, created_at | In-app notifications |
| **activity_logs** | id, user_id, action, entity, entity_id, created_at | Audit trail |
| **password_reset_tokens** | token, user_id, expires_at, used | Password reset flow |

---

## API Overview

All endpoints return JSON. Standard error format: `{ error: string }`. Status codes follow REST conventions.

### Module Routes (all prefixed with `/api/v1`)

| Module | Routes | Auth |
|--------|--------|------|
| **Auth** | login, register, refresh, logout, me, change-password, forgot-password, reset-password | Mixed |
| **Attendance** | check-in, check-out, pause-start, pause-end, today, monthly, list, update | Yes |
| **Users** | list, create, update, delete, stats, get-by-id | Yes (director/hr) |
| **Departments** | list, create, update, delete, stats, get-by-id | Yes (director/hr) |
| **Teams** | list, create, update, delete, add/remove members, my-teams | Yes |
| **Tasks** | CRUD, list, stats, comments, approvals | Yes |
| **Plans** | CRUD, submit, review | Yes |
| **Reports** | CRUD, submit, review | Yes |
| **Leaves** | CRUD, balance, review, cancel | Yes |
| **Notifications** | list, mark-read, mark-all-read, delete | Yes |
| **Activity Logs** | list | Yes (director/hr) |
| **Holidays** | list, create, delete | Yes (director/hr) |
| **Analytics** | attendance-trends, department-stats, leave-usage, task-summary | Yes (director/hr) |

### Auth Methods
- `Authorization: Bearer <access-token>` header
- `Authorization: Refresh <refresh-token>` header (for refresh endpoint)
- httpOnly cookie-based refresh on page load

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Environment mode |
| `PORT` | 4000 | API server port |
| `CORS_ORIGIN` | http://localhost:3000 | Allowed CORS origins |
| `DATABASE_PATH` | data.db | SQLite database file path |
| `JWT_ACCESS_SECRET` | (auto-generated) | Access token signing key |
| `JWT_REFRESH_SECRET` | (auto-generated) | Refresh token signing key |
| `JWT_ACCESS_TTL` | 15m | Access token expiry |
| `JWT_REFRESH_TTL_DAYS` | 30 | Refresh token expiry in days |
| `MAX_LOGIN_ATTEMPTS` | 5 | Failed attempts before lockout |
| `LOCKOUT_MINUTES` | 15 | Account lockout duration |
| `ENABLE_HTTPS` | false | Enable self-signed HTTPS |

---

## Quality Gates

### Backend (`server/`)
- [ ] `npm run lint` - ESLint passes
- [ ] `npm run build` - TypeScript compilation succeeds
- [ ] `npm run typecheck` - Type checks pass
- [ ] `npm test` - All tests passing (>= 60 tests)
- [ ] `npm run seed` - Database seeds successfully
- [ ] `npm run backup` - Backup functionality works
- [ ] `npm run backup:list` - Lists backups

### Frontend (`web/`)
- [ ] `npm run lint` - ESLint passes
- [ ] `npm run build` - Next.js production build succeeds
- [ ] `npm run typecheck` - Type checks pass

### Manual Tests
- [ ] Browser login test - login, refresh, logout, protected routes
- [ ] End-to-end smoke test - attendance, task, plan, report, leave flows

### Run Commands
```
# Development - starts both backend (4000) and frontend (3000)
npm run dev

# Production build
npm run build

# Production start
npm start

# Root-level scripts
npm run lint          ← lint both packages
npm run typecheck     ← typecheck backend only
```

---

## Sprint Plan & Work Items

### Current Sprint Focus: Quality Gate Completion & Manual E2E Test

| Priority | Task | Description | Status |
|----------|------|-------------|--------|
| **High** | Fix any lint/type errors | Run `npm run lint` and `npm run typecheck` across both packages | Pending |
| **High** | Run full test suite | Execute `npm test` in server, ensure all 60+ tests pass | Pending |
| **High** | Manual browser login test | Test login, refresh token, logout, protected route redirects | Pending |
| **High** | E2E smoke test | Verify attendance, task, plan, report, leave flows end-to-end | Pending |
| **Medium** | Fix known bugs | Review anchored-summary.md for outstanding issues | Pending |
| **Low** | Update documentation | Ensure plan.md, README.md match code state | Pending |

### Backend Work Items
1. **Authentication Module** - Refresh token rotation, logout revocation, password reset flow
2. **Attendance Service** - Check-in/out state machine, auto-absent scheduler, overtime/half-day detection
3. **Task Service** - CRUD with assignments, comments, attachments, approvals
4. **Plan/Report Service** - Submit/review workflow, one-per-day validation
5. **Leave Service** - Application, approval workflow, balance tracking
6. **Notification Service** - Create notifications from key actions, unread count
7. **Activity Log Service** - Audit trail for all entity changes
8. **Security Hardening** - IDOR prevention, self-approval prevention, role re-fetch
9. **Backup/Restore** - WAL-safe database backup functionality
10. **API Tests** - Comprehensive test suite for all modules

### Frontend Work Items
1. **Authentication UI** - Login form, refresh on mount, logout, error states
2. **Attendance UI** - Check-in/out controls, monthly summary, filters
3. **Tasks UI** - Create/edit tasks, assignments, comments, attachments, filters
4. **Plans UI** - Create/submit plans, manager review queue
5. **Reports UI** - Submit reports, manager approval, filters
6. **Leaves UI** - Apply for leave, review status, balance view
7. **Notifications UI** - Unread count, mark-read, delete
8. **Dashboard UI** - Role-aware navigation, quick stats
9. **Analytics UI** - Charts and filters for attendance, leaves, tasks
10. **Export UI** - CSV export for attendance, tasks

### Database Work Items
1. **Schema Maintenance** - Ensure 16 tables are consistent
2. **Migration Support** - Document PostgreSQL migration path
3. **Backup Strategy** - WAL-safe backups with timestamping
4. **Index Optimization** - Query performance for frequent lookups

### Security Work Items
1. **Rate Limiting** - Configure global and endpoint-specific limits
2. **Cookie Security** - httpOnly, SameSite, Secure flags
3. **CORS Configuration** - Explicit origins with credentials
4. **Helmet Headers** - CSP, XSS, HSTS protection
5. **Account Lockout** - 5 failed attempts → 15-min lockout
6. **Password Policy** - bcrypt 12 rounds, reset token security

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SQLite concurrency issues | Medium | Medium | WAL mode, handle SQLITE_BUSY errors |
| JWT token theft via XSS | Low | High | Access token in memory only, refresh in httpOnly cookie |
| Rate limiting misconfiguration | Medium | Medium | Test all endpoints under load |
| Database backup corruption | Low | High | Verify backup integrity, WAL-aware backup script |
| Role escalation via stale JWT | Medium | High | Re-fetch roles from DB on every authenticated request |
| CSV injection in exports | Low | Medium | Sanitize all exported data |
| Auto-absent scheduler misses dates | Low | Medium | Test across weekends, holidays, timezone changes |

---

## Success Metrics

- [ ] All quality-gate commands pass (lint, build, typecheck, test)
- [ ] Manual browser login verified (login, refresh, logout, protected routes)
- [ ] E2E smoke test covers all core workflows (attendance, tasks, plans, reports, leaves)
- [ ] Admin, manager, and employee can complete daily workflows end-to-end
- [ ] Application runs from fresh setup using documented commands
- [ ] Project documents match actual code state
- [ ] Known limitations are clearly documented

---

## Post-MVP Roadmap (High-Level)

1. **Post-MVP**: PostgreSQL production configuration with migration path
2. **Phase 2**: Analytics dashboards (attendance trends, task completion, department stats)
3. **Phase 3**: Better exports (Excel, PDF, scheduled reports, templates)
4. **Phase 4**: Real-time notifications (SSE or WebSocket polling)
5. **Phase 5**: File storage (cloud uploads with validation)
6. **Phase 6**: Security hardening (password policy, lockout, audit coverage)
7. **Phase 7**: Docker deployment, CI/CD, health checks, production runbook

---

## Notes & Constraints

- **SQLite chosen** for local development - no DB server required, sufficient for 30-35 users
- **IST timezone** (Asia/Kolkata) for all attendance date calculations
- **UTC timestamps** for login/logout audit trail
- **JWT access token** stored in React state (memory), not localStorage
- **Refresh token** stored in httpOnly cookie, not accessible to JavaScript
- **Role re-fetched** from database on every authenticated request to prevent stale JWT escalation
- **No chat feature** - removed per user request to avoid database bloat
- **Production deployment** will need PostgreSQL migration documented
- **Backup directory** must be writable for `npm run backup` to work
- **Frontend clear cache** required if `.next` causes webpack errors

---

*Plan generated on August 24, 2026. This document should be kept in sync with the codebase state. For the latest changes, refer to anchored-summary.md, UPDATE.md, and MVP_TODO.md.*