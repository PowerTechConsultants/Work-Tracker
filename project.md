# Project Plan & Development Process

## Overview

Employee Work Tracker is a full-stack workforce management application designed for small to medium teams (30-35 employees). It replaces manual spreadsheets and ad-hoc tracking with a centralized system for attendance, tasks, leaves, and reporting.

## Objectives

- Track daily employee attendance with check-in/check-out, pause/resume, and automatic absent marking
- Manage tasks with assignments, comments, approvals, and progress tracking
- Handle leave applications with approval workflows and balance management
- Enable daily work plans and end-of-day reports with manager review
- Provide analytics dashboards for admin/HR decision-making
- Secure authentication with JWT rotation and role-based access control

## Database Schema

SQLite with 17 tables:

- **users** — Employee records with roles (admin/hr/employee), status, login tracking, lockout
- **departments** — Department hierarchy with manager assignment
- **team_members** — User-team membership (composite key: user_id + team_name)
- **refresh_tokens** — JWT refresh token storage with revocation support
- **attendance** — Daily attendance records with status (present/absent/leave/holiday/on_break/work_end/half_day), working hours, overtime, pause tracking
- **tasks** — Work tasks with priority, status, progress, estimated/actual hours
- **task_assignments** — Many-to-many task-user assignments
- **task_comments** — Task discussion comments
- **task_attachments** — File attachments on tasks
- **task_approvals** — Task approval workflow (pending/approved/rejected)
- **work_plans** — Daily work plans with review workflow
- **work_reports** — End-of-day work reports with review workflow
- **leaves** — Leave applications (sick/casual/annual/other) with approval workflow
- **document_requests** — Employee document requests (appointment letter, experience/internship/leaving certificate, salary slip) with HR/Admin fill-and-issue workflow, per-type template fields (JSON), generated document numbers and issue tracking
- **holidays** — Company holidays (all-employees or per-user assignment)
- **holiday_assignees** — Per-user holiday mapping
- **notifications** — In-app notification system
- **activity_logs** — Audit trail for all entity changes
- **password_reset_tokens** — Secure password reset flow
- **time_entries** — Optional per-task time tracking
- **chat_messages** — (Table exists, feature removed per user request)

## Development Process

### Phase 1: Foundation
- Project scaffolding with Express + Next.js
- SQLite schema design with WAL mode
- JWT authentication with httpOnly cookie rotation
- RBAC middleware (admin/hr/employee)
- Rate limiting, CORS, Helmet security headers
- Error handling middleware

### Phase 2: Core Features
- Attendance module with state machine (check-in → pause → resume → check-out)
- Auto-detection of half-day (<4 hours) and overtime (>8 hours)
- Auto-absent scheduler (daily 6:30 PM IST, skips weekends/holidays)
- Attendance override on check-in (converts absent/leave/holiday → present)
- Leave application with approval workflow
- Leave → attendance integration (approved leaves auto-create records)
- Department CRUD with manager assignment

### Phase 3: Task Management
- Task CRUD with priority, status, progress
- Task assignment to multiple users
- Comments with author names
- Approval workflow (request → approve/reject)
- Task statistics and filtering

### Phase 4: Work Planning & Reporting
- Daily work plans with planned work, priority, estimated hours
- Plan submission and manager review
- End-of-day reports with completed work, blockers, tomorrow's plan
- Report submission and feedback workflow

### Phase 5: Analytics & Dashboard
- Attendance trends (monthly charts)
- Department statistics (headcount, attendance rates)
- Leave usage analytics (yearly)
- Task completion summary
- Recharts-based frontend dashboards

### Phase 6: Security Hardening
- IDOR prevention (users can only access own data)
- Self-approval prevention for leaves/tasks
- Stale JWT role re-fetch from database on every request
- Refresh token rotation with revocation tracking
- Password reset token (one-time use, 1-hour expiry)
- Account lockout after failed attempts
- CSV injection prevention
- XSS protection (refresh token in httpOnly cookie, not localStorage)
- Rate limiting (global 500/15min, auth 10/15min)

### Phase 7: Testing & Polish
- 60 backend tests across 6 suites (services, routes, crash scenarios)
- All tests passing with shared SQLite test database
- Frontend build clean (19 pages)
- Dark theme responsive UI
- Database backup functionality

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite over PostgreSQL | Single file, no DB server, sufficient for 30-35 employees |
| better-sqlite3 (raw SQL) | No ORM overhead, full control over queries |
| WAL journal mode | Concurrent reads with write queue |
| IST timezone for attendance | Asia/Kolkata for all date calculations |
| UTC timestamps for login/logout | Standardized audit trail |
| JWT access in memory only | Cannot be stolen via XSS |
| Refresh token in httpOnly cookie | Not accessible to JavaScript |
| Role re-fetched on every request | Prevents stale JWT privilege escalation |
| Check-in overrides leave/holiday/absent | Work presence takes priority |
| Chat removed | User request to avoid database bloat |

## Security Architecture

- **Authentication:** JWT access token (15min TTL) + refresh token (30-day TTL)
- **Token storage:** Access token in memory (React state), refresh token in httpOnly cookie
- **Token refresh:** Automatic on page load via cookie-based POST /auth/refresh
- **Password hashing:** bcrypt with 12 salt rounds
- **Rate limiting:** Global 500/15min, auth endpoints 10/15min (skip successful), write operations 100/15min
- **Account lockout:** 5 failed attempts → 15-minute lockout
- **Role verification:** Re-fetched from DB on every authenticated request
- **CORS:** Explicit origins with credentials: true
- **Helmet:** Security headers (CSP, XSS, etc.)

## API Design

All endpoints return JSON. Standard error format: `{ error: string }`. Status codes follow REST conventions (200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 423 Locked, 429 Too Many Requests, 500 Internal Server Error).

## Frontend Architecture

- Next.js 15 App Router with 19 page routes
- React 19 with server components
- Auth context with cookie-based refresh on mount
- TanStack React Query for data fetching
- Axios with interceptors for token injection
- Tailwind CSS 4 with dark theme
- Recharts for analytics charts
- Lucide React icons
- Socket.IO client for real-time notifications
- Responsive sidebar layout with role-based navigation
