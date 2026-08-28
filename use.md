# User Guide

## Roles & Permissions

| Feature | Admin | HR | Employee |
|---------|-------|----|----------|
| Attendance (self) | Full | Full | Full |
| Attendance (others) | View/edit all | View/edit all | Own only |
| Tasks (self) | View assigned | View assigned | View assigned |
| Tasks (create/edit all) | Yes | Yes | No |
| Users management | Full CRUD | View list | No |
| Departments | Full CRUD | View | No |
| Teams | Full CRUD | View | View own |
| Leaves (self) | Full | Full | Full |
| Leaves (review) | Yes | Yes | No |
| Work Plans (self) | Full | Full | Full |
| Work Plans (review) | Yes | Yes | No |
| Work Reports (self) | Full | Full | Full |
| Work Reports (review) | Yes | Yes | No |
| Holidays | Full CRUD | Full CRUD | No |
| Activity Logs | View | View | No |
| Analytics | View | View | No |

## Use Cases

### 1. Daily Attendance

#### Check In
1. Log in and navigate to **Attendance** from the sidebar
2. Click **Check In** button
3. Status changes to `present` with current timestamp
4. If you already have an `absent`, `leave`, or `holiday` record for today, check-in automatically overrides it

#### Take a Break (Pause/Resume)
1. While checked in, click **Pause** to start a break
2. Status changes to `on_break`, pause timer starts
3. Click **Resume** to end the break
4. Total break time is tracked for information (not deducted from working hours)

#### Check Out
1. Click **Check Out** to end the workday
2. System automatically calculates:
   - **Working hours** (time between check-in and check-out minus pauses)
   - **Overtime** (if working hours > 8)
   - **Half-day** status (if working hours < 4)
3. Status becomes `work_end` or `half_day`

#### View Monthly Summary
1. Go to **Attendance** page
2. View current month's statistics: present days, absent days, leaves, total working hours, overtime
3. Admin/HR can view any user's summary by selecting from the user list

### 2. Leave Management

#### Apply for Leave
1. Go to **Leaves** from sidebar
2. Click **Apply Leave**
3. Select leave type (Sick/Casual/Annual/Other)
4. Choose start and end dates
5. Enter reason and submit
6. Status shows `pending` until reviewed

#### Review Leave (Admin/HR)
1. Go to **Leaves** → **Pending Requests**
2. Review the application details
3. **Approve** — auto-creates `leave` attendance records for the date range
4. **Reject** — optionally add a comment

#### Cancel Leave
- **Employee:** Can cancel own pending leaves
- **Admin/HR:** Can cancel any approved/pending leave
- Cancellation removes associated attendance records

#### Leave Balance
- View your remaining leave balance by type
- Balance updates automatically when leaves are approved

### 3. Task Management

#### Create Task (Admin/HR)
1. Go to **Tasks** → **Create Task**
2. Enter title, description, priority (low/medium/high/urgent)
3. Set due date and estimated hours
4. Assign to one or more employees
5. Submit — task appears on assignees' dashboards

#### Update Progress
1. Open a task
2. Update progress percentage or change status
3. Add comments for team discussion

#### Request Approval
1. Open a task
2. Click **Request Approval**
3. Add a review comment
4. Admin/HR reviews and approves/rejects

### 4. Work Plans

#### Create Daily Plan
1. Go to **Plans** from sidebar
2. Click **New Plan**
3. Describe planned work for today
4. Set priority and estimated hours
5. Save as draft or submit for review

#### Submit & Review
- **Submit** plan to make it visible to managers
- **Admin/HR** can review and provide feedback
- Statuses: `draft` → `submitted` → `approved` / `needs_improvement`

### 5. Work Reports

#### Create End-of-Day Report
1. Go to **Reports** from sidebar
2. Click **New Report**
3. Fill in: work completed, current progress, pending work, blockers, tomorrow's plan
4. Submit for manager review

#### Review Reports (Admin/HR)
1. View submitted reports from all employees
2. Add feedback and mark as reviewed
3. Track blockers and pending work across the team

### 6. Team Management (Admin/HR)

#### Create Department
1. Go to **Departments**
2. Add name, description, assign manager

#### Manage Teams
1. Go to **Teams**
2. Create team with name and department
3. Add/remove members

### 7. Holidays (Admin/HR)

1. Go to **Holidays**
2. Click **Add Holiday** — set date, name, and type
3. Assign to **All Employees** (default) or **Specific Users**
4. Assigned holidays auto-skip the absent marking for affected users

### 8. Dashboard

- **Employee:** View today's attendance status, assigned tasks, pending leaves, upcoming plans
- **Admin/HR:** View organization-wide stats — active employees, present/absent today, pending approvals, department breakdown

### 9. Analytics (Admin/HR)

Go to **Analytics** from sidebar:

- **Attendance Trends** — Monthly bar chart showing present vs absent/leave/holiday
- **Department Stats** — Headcount and attendance rates by department
- **Leave Usage** — Yearly leave consumption trends
- **Task Summary** — Task completion rates and status distribution

### 10. Notifications

- Real-time notifications via Socket.IO
- Bell icon in the top bar shows unread count
- Click to view and mark as read
- Types: leave approved/rejected, task assigned, plan reviewed, report feedback

### 11. Activity Logs (Admin/HR)

- Complete audit trail of all system changes
- Filter by entity type, action, and date range
- Track who changed what and when

### 12. Account Management

#### Change Password
1. Go to user menu → **Change Password**
2. Enter current password and new password
3. All existing sessions are revoked (logout everywhere)

#### Forgot Password
1. Click **Forgot Password** on login page
2. Enter email
3. Reset token is output to server console
4. Click the reset link with the token to set a new password

## Auto-Absent System

The system automatically marks absent records for active users who have no attendance record for a given day. This runs every 60 seconds and triggers at **6:30 PM IST**. It skips:
- Saturdays and Sundays
- Days marked as holidays (all-employees or per-user)

Users who check in after being auto-marked absent get their record overridden to `present`.

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Dark theme supported, light theme not implemented

## API Client Examples

### Login
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123"}'
```

### Authenticated Request
```bash
curl -X GET http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

### Check In
```bash
curl -X POST http://localhost:4000/api/v1/attendance/check-in \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"status":"present"}'
```

### Create Task
```bash
curl -X POST http://localhost:4000/api/v1/tasks \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login bug","priority":"high","assigneeIds":["<user-id>"]}'
```

### Apply Leave
```bash
curl -X POST http://localhost:4000/api/v1/leaves \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"type":"sick","startDate":"2026-07-25","endDate":"2026-07-26","reason":"Not feeling well"}'
```
