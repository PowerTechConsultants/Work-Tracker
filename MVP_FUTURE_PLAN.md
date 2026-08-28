# Employee Work Tracker - MVP Future Plan

Last updated: June 10, 2026

## Current MVP Baseline

The project is a runnable full-stack Employee Work Tracker with:

- Express + TypeScript backend
- Prisma ORM with SQLite for local development
- Next.js + TypeScript frontend
- JWT access and refresh token authentication
- Role-based middleware
- Seeded admin account
- Basic pages for dashboard, attendance, tasks, plans, reports, leaves, notifications, logs, login, and registration
- Verified backend build, lint, tests, seed, and live health check
- Verified frontend lint, production build, and live login page

Default local admin:

- Email: `admin@example.com`
- Employee ID: `EMP-0001`
- Password: `Admin@123`
- Display name: `Admin`

## MVP Completion Goal

The MVP should prove that an employee, manager, and admin can complete the most important daily workflows end to end:

1. Login and maintain a session.
2. Check in and check out attendance.
3. Create and review daily plans.
4. Submit and review daily reports.
5. Create, assign, update, and comment on tasks.
6. Apply for leave and review leave requests.
7. See notifications and activity logs.
8. Export basic reports.

## Must Finish Before Calling MVP Complete

### 1. Authentication and Session Flow

- Verify login, refresh token, logout, and protected route redirects in the browser.
- Add visible error states for expired sessions and failed refresh.
- Add user profile display consistency across dashboard and layout.
- Add tests for refresh token rotation and logout revocation.

### 2. Attendance Workflow

- Prevent duplicate check-ins with clearer UI messaging.
- Add monthly attendance summary to the attendance page.
- Add manager/admin attendance review view.
- Add validation for date, login time, logout time, and working hours.
- Add tests for check-in, check-out, history, and summary.

### 3. Task Workflow

- Add task edit/update controls in the UI.
- Add status and priority filters.
- Add comments UI.
- Add attachment upload UI and file preview/download link.
- Add manager task assignment view.
- Add tests for task create, update, comments, and attachments.

### 4. Daily Plans and Reports

- Add manager review queue for submitted plans.
- Add manager approval/comment flow for reports.
- Add filters by date range and status.
- Add validation for one plan/report per day.
- Add tests for create, list, review, and approve paths.

### 5. Leave Management

- Add manager/admin leave review UI.
- Add status badges and filtering.
- Add leave date validation.
- Add basic leave balance placeholder or company policy note.
- Add tests for apply, list, approve, reject, and permission rules.

### 6. Notifications and Activity Logs

- Create notifications from important actions:
  - task assignment
  - leave approval/rejection
  - plan/report review
- Add unread count in navigation.
- Add activity logs for key mutations.
- Add tests for notification read state and activity logging.

### 7. Reports and Exports

- Keep CSV export as the MVP export format.
- Add UI button for attendance CSV export.
- Add UI button for task CSV export.
- Add manager/admin filtered exports by user and date.
- Add tests for CSV output.

### 8. Admin and Manager Experience

- Add admin user list management UI.
- Add manager team overview.
- Add department management UI.
- Add role-aware navigation.
- Verify employees cannot access manager/admin-only routes.

### 9. Quality Gate

Before MVP sign-off, these must pass:

- `server`: `npm run lint`
- `server`: `npm run build`
- `server`: `npm test`
- `server`: `npm run seed`
- `web`: `npm run lint`
- `web`: `npm run build`
- Manual browser login test
- Manual end-to-end smoke test for attendance, task, plan, report, and leave flows

## Post-MVP Roadmap

### Phase 1: Production Database Path

- Keep SQLite for local development.
- Add documented PostgreSQL production configuration.
- Add migration instructions for PostgreSQL.
- Add separate `.env.example` values for local and production.
- Verify Prisma schema compatibility with both local and production database choices.

### Phase 2: Analytics Dashboard

- Attendance trend charts.
- Task completion rate.
- Department performance summary.
- Employee productivity summary.
- Manager team dashboard.

### Phase 3: Better Exports

- Excel export.
- PDF report export.
- Scheduled report generation.
- Export templates for attendance, tasks, leaves, and productivity.

### Phase 4: Real-Time and Notifications

- Polling-based notification refresh first.
- WebSocket or server-sent events later if needed.
- Email notifications for password reset and approvals.

### Phase 5: File Storage

- Replace local upload storage with cloud or configurable storage.
- Add file type validation.
- Add file size and retention rules.
- Add secure access checks for attachments.

### Phase 6: Security Hardening

- Add stricter password policy.
- Add account lockout or login throttling.
- Add audit coverage for admin actions.
- Add secure cookie option for refresh tokens.
- Review CORS and production headers.

### Phase 7: Deployment and Operations

- Add Docker build for backend and frontend.
- Add deployment runbook.
- Add CI workflow for lint, build, and tests.
- Add health checks and logging notes.
- Add backup and restore notes for production database.

## Suggested Immediate Next Sprint

Focus on finishing one complete vertical slice instead of touching every feature lightly.

Recommended sprint:

1. Browser-test login and protected routes.
2. Finish attendance UI and API tests.
3. Finish task status update and comments UI.
4. Add manager review screens for leaves and reports.
5. Add role-aware navigation cleanup.
6. Run the full quality gate.

## Definition of Done for MVP

The MVP is complete when:

- Admin, manager, and employee accounts can each complete their expected workflows.
- The app runs from fresh setup using documented commands.
- All quality-gate commands pass.
- The core browser flows are manually verified.
- Project documents match the actual state of the code.
- Known limitations are listed clearly.

