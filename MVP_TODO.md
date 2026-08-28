# Employee Work Tracker MVP TODO

Last updated: July 4, 2026

## Goal

Complete the MVP so employee, manager, and admin users can finish the core daily workflows end to end, with passing quality checks and documented limitations.

## 1. Authentication and Session Flow

- [x] Browser-test login, refresh token, logout, and protected route redirects.
- [x] Show clear UI errors for expired sessions and failed refresh.
- [x] Keep user profile display consistent across dashboard and layout.
- [x] Add tests for refresh token rotation and logout revocation.

## 2. Attendance Workflow

- [x] Prevent duplicate check-ins with clear API and UI messaging.
- [x] Add monthly attendance summary to the attendance page.
- [x] Add manager/admin attendance review view.
- [x] Validate date, login time, logout time, and working hours.
- [x] Add full API tests for check-in, check-out, history, and summary.

## 3. Task Workflow

- [x] Add task edit/update controls in the UI.
- [x] Add status and priority filters.
- [x] Add comments UI.
- [x] Add attachment upload UI and file preview/download links.
- [x] Add manager task assignment view.
- [x] Add tests for task create, update, comments, and attachments.

## 4. Daily Plans and Reports

- [x] Add manager review queue for submitted plans.
- [x] Add manager approval/comment flow for reports.
- [x] Add filters by date range and status.
- [x] Validate one plan/report per day with friendly errors.
- [x] Add tests for create, list, review, and approve paths.

## 5. Leave Management

- [x] Add manager/admin leave review UI.
- [x] Add status badges and filtering.
- [x] Validate leave dates.
- [x] Add basic leave balance placeholder or company policy note.
- [x] Add tests for apply, list, approve, reject, and permission rules.

## 6. Notifications and Activity Logs

- [x] Create notifications from task assignment.
- [x] Create notifications from leave approval/rejection.
- [x] Create notifications from plan/report review.
- [x] Add unread count in navigation.
- [x] Add activity logs for key mutations.
- [x] Add tests for notification read state and activity logging.

## 7. Reports and Exports

- [x] Keep CSV as the MVP export format.
- [x] Add UI button for attendance CSV export.
- [x] Add UI button for task CSV export.
- [x] Add manager/admin filtered exports by user and date.
- [x] Add tests for CSV output.

## 8. Admin and Manager Experience

- [x] Add admin user list management UI.
- [x] Add manager team overview.
- [x] Add department management UI.
- [x] Add role-aware navigation.
- [x] Verify employees cannot access manager/admin-only routes.

## 9. Quality Gate

- [x] `server`: `npm run lint`
- [x] `server`: `npm run build`
- [x] `server`: `npm test` (27 tests passing)
- [x] `server`: `npm run seed`
- [x] `web`: `npm run lint`
- [x] `web`: `npm run build`
- [ ] Manual browser login test
- [ ] Manual end-to-end smoke test for attendance, task, plan, report, and leave flows

## Current Sprint

1. [x] Finish attendance API validation and duplicate check-in handling.
2. [x] Add monthly attendance summary to the attendance page.
3. [x] Add focused attendance tests.
4. [x] Run server build/tests and web lint/build.
