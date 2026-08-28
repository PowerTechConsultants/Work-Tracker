export const ROLES = {
  DIRECTOR: 'director',
  HR: 'hr',
  EMPLOYEE: 'employee',
} as const;

export const ROLES_ARRAY = Object.values(ROLES);

export const ADMIN_ROLES = [ROLES.DIRECTOR, ROLES.HR] as const;

export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ON_BREAK: 'on_break',
  WORK_END: 'work_end',
  ABSENT: 'absent',
  LEAVE: 'leave',
  HALF_DAY: 'half_day',
  HOLIDAY: 'holiday',
  REMOTE: 'remote',
} as const;

export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
  CANCELLED: 'cancelled',
} as const;

export const LEAVE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

export const LEAVE_TYPES = {
  CASUAL: 'casual',
  SICK: 'sick',
  EARNED: 'earned',
  PAID: 'paid',
  UNPAID: 'unpaid',
  MATERNITY: 'maternity',
  PATERNITY: 'paternity',
} as const;

export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const;

export const PLAN_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;
