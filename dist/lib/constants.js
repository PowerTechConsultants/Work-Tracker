export const ROLES = {
    DIRECTOR: 'director',
    HR: 'hr',
    EMPLOYEE: 'employee',
};
export const ROLES_ARRAY = Object.values(ROLES);
export const ADMIN_ROLES = [ROLES.DIRECTOR, ROLES.HR];
export const ATTENDANCE_STATUS = {
    PRESENT: 'present',
    ON_BREAK: 'on_break',
    WORK_END: 'work_end',
    ABSENT: 'absent',
    LEAVE: 'leave',
    HALF_DAY: 'half_day',
    HOLIDAY: 'holiday',
    REMOTE: 'remote',
};
export const TASK_STATUS = {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    ON_HOLD: 'on_hold',
    CANCELLED: 'cancelled',
};
export const LEAVE_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled',
};
export const LEAVE_TYPES = {
    CASUAL: 'casual',
    SICK: 'sick',
    EARNED: 'earned',
    PAID: 'paid',
    PROPOSAL: 'proposal',
    UNPAID: 'unpaid',
    MATERNITY: 'maternity',
    PATERNITY: 'paternity',
};
export const USER_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended',
};
export const PLAN_STATUS = {
    DRAFT: 'draft',
    SUBMITTED: 'submitted',
    APPROVED: 'approved',
    REJECTED: 'rejected',
};
