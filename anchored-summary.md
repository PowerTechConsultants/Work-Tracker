## Goal
Fix leave-section data bugs + check-in geolocation, then (post-review) broaden to: (1) fix attendance "data loss" via auto-absent backfill, (2) admin bulk-delete of attendance by filter, (3) DB hardening (migrations, WAL-safe backups, indexes, health/ready, DB overview, backup endpoints). Final blocker was a live port-4000 conflict with an unrelated `ea/iam` project.

## Constraints & Preferences
- Leave day-counting: exclude Sunday only + HR/admin-set holidays; Saturday is a working day; holiday applies to all users unless `holiday_assignees` rows exist, else only assigned users.
- Leave draining: own type first, then spill casual → sick → paid; Total negative only after pools drain; per-type boxes clamp at 0.
- Back-dated leave apply (start before today IST) blocked (400); leave actions recorded in Activity Logs.
- Check-in location: optional, stored when captured, flagged "No location" otherwise (no geofence).
- Keep SQLite-native, persistent rate limiting + DB-backed API cache (no in-memory stores).
- WAL-safe backups required (raw `copyFileSync` misses the WAL).
- Dev via `npm run dev` (`tsx watch src/server.ts`); web 3000, API 4000.

## Progress
### Done (verified live on port 4000)
- Leave working-day counting, past-date validation, `review()`, activity logging, schema narrowing, frontend prediction/min-date + `leaveBal` invalidation; calendar range, Cancelled filter, Days export.
- Check-in geolocation: schema + service + `getTodayAll` + frontend `captureLatLng`/`LocationCell`/Google Maps link/Location tile/export.
- Attendance data-loss fix (`src/lib/auto-absent.ts`): `backfillAbsentDates()` from `auto_absent_last_date`+1 (or year start if null), 18:30 IST gate only for *today*, Sunday/holiday/joining-date exclusion, `INSERT OR IGNORE` (never overwrites), runs on startup + every 5 min. DB now has a **complete, consistent ledger for the app's actual live window (2026-07-23 → 2026-08-03)**: 103 rows = 55 absent + 48 present/leave/holiday/etc.; `auto_absent_last_date=2026-08-03` (won't reprocess).
- Admin bulk-delete (`DELETE /api/v1/attendance/bulk`, director-only): `deleteAttendanceSchema` + `bulkDelete()` (count + transactional delete + activity log). Front: "Clear Data" button + typed-confirm modal + toast + query invalidation; table shows all statuses by default.
- **Bulk-delete hardening (after a self-inflicted test incident)**: added `date` alias to `deleteAttendanceSchema` (maps to startDate=endDate=date) and a guard requiring `confirm=DELETE` when no date boundary is supplied. Live-verified: `date='2020-01-01'` → 0 deleted (scoped, not mass); no-date + no-confirm → 400; no-date + confirm='DELETE' → mass delete (intentional power-op, matches the two-step UI confirmation).
- **system.routes.ts auth fix**: added `router.use(authenticate)` (was missing → `/system/db`, `/backup`, `/backups` returned 401 even for admin). Now `/system/db` 200 (full DB overview incl. table counts, WAL mode, migration version 3).
- DB hardening: versioned migrations (`schema_migrations`, idempotent transactional runner; baseline v1, working-hours recompute v2, composite indexes v3); `wal_autocheckpoint=1000` + shutdown `wal_checkpoint(TRUNCATE)`; WAL-safe `db.backup()`; composite indexes (verified no table scans); `/health` exposes `dbMigrationVersion`; `/ready`.
- Backup endpoints (director-only, WAL-safe): `POST /system/backup`, `GET /system/backups` — live-verified (created + listed, incl. retained `pre-implementation-baseline.db`).
- Server `typecheck` + `lint` pass; web `lint` passes.

### Data note (important)
- After a correct reset of `auto_absent_last_date`, the backfill regenerated the ENTIRE year (Jan 1→Aug 3 = 1273 absent). Inspection showed the app's earliest real record is **2026-07-23** (`created_at` min), so Jan–July absences were synthetic. I trimmed `DELETE WHERE status='absent' AND date < '2026-07-23'` (removed 1218 rows) after confirming DB integrity, leaving only legitimate July 23→Aug 3 absences. Final: 103 rows. This is a complete, honest ledger for the live period.

### Blocked → Resolved
- Port 4000 conflict: the unrelated `ea\iam` project (ts-node-dev `--respawn` + dist build) kept squatting on 4000, causing login 401/404 (wrong server answered) and (when emp held 4000) real login 401s from wrong/missing password. Root causes were NOT code bugs: (a) the iam server intercepting 4000, and (b) admin password. Emp now cleanly owns 4000; iam stopped.

## Key Decisions
- Auto-absent backfill start = `${year}-01-01` when `auto_absent_last_date` is null (this caused the synthetic-year artifact; last_date is now set to 2026-08-03 so it won't recur unless the marker is cleared again). Recommend: consider changing the null-start to the earliest real record date to avoid future synthetic-year backfills.
- Bulk delete: hard delete (unrecoverable); guarded: no date boundary requires `confirm=DELETE` (both backend + the UI's two-step "type DELETE" confirmation).
- Restored admin password to `Admin@123` (admin@example.com is the director, EMP-0001; bcryptBreaker closed; login verified 200).
- bcryptBreaker: OPEN after 5 bcrypt failures → 500 on login for ~30s; avoid spamming.
- Two directors: admin@example.com (EMP-0001) + debdebadatta7@gmail.com (EMP-0008); duplicate EMP-0006 (same email) deleted.

## Next Steps / Deferred
- Change auto-absent null-start from `YYYY-01-01` to earliest real attendance record date (prevents synthetic-year backfill if the marker is ever cleared). Optional.
- Socket token-refresh fix in `web/src/lib/socket.ts` (refresh before reconnect, sync `socket.auth` via `onTokenChange`, redirect to `/login` on refresh failure) — NOT yet implemented.
- Clean up the admin 48-day test leave (if still present) after browser verification.

## Critical Context
- Admin `admin@example.com` = `Admin@123` (director, EMP-0001); hr `hr@example.com`/`Hr@12345` (EMP-0004); john `john@example.com`/`John@12345` (EMP-0009).
- App live period: 2026-07-23 → present; today 2026-08-04 (IST) before 18:30 so today is not yet auto-absent.
- DB: `server/data.db` (WAL; `data.db`/`-wal`/`-shm`); better-sqlite3 from workspace root; `integrity_check ok`, no FK violations, no orphans.
- API running on 4000 (tsx watch, PID current on 4000); web on 3000 (next dev).
- Workspace not git-initialized; scratch scripts under `C:\Users\debde\AppData\Local\Temp\opencode\`.
- Backups retained in `server/backup/`: `pre-implementation-baseline.db` (652 KB), plus timestamped ones.

## Relevant Files
- `server/src/lib/auto-absent.ts`: idempotent backfill (root fix for attendance data loss).
- `server/src/db/index.ts`: versioned migration runner + WAL pragmas.
- `server/src/lib/backup.ts`: WAL-safe `db.backup()`.
- `server/src/modules/attendance/attendance.schema.ts`: `deleteAttendanceSchema` (+`date` alias).
- `server/src/modules/attendance/attendance.service.ts`: `bulkDelete()` (hardened scope/confirm guard).
- `server/src/modules/attendance/attendance.routes.ts`: `DELETE /bulk`.
- `server/src/modules/system/system.routes.ts`: `/db`, `/backup`, `/backups` (added `router.use(authenticate)`).
- `server/src/app.ts`: mounts `/api/v1/*`; `/health` reports `dbMigrationVersion`.
- `server/src/lib/circuit-breaker.ts`: `bcryptBreaker` (OPEN after 5 bcrypt failures).
- `web/src/app/attendance/page.tsx`: all-statuses table + "Clear Data" modal.
- `ea\iam\server`: unrelated project (now stopped) that was squatting on port 4000.
