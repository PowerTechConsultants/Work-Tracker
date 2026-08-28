export interface User {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'director' | 'hr' | 'employee';
  departmentId: string | null;
  designation: string | null;
  status: 'active' | 'inactive' | 'suspended';
  phoneNumber: string | null;
  joiningDate: string | null;
  profilePictureUrl: string | null;
}

export interface UserWithPassword extends User {
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  managerId: string | null;
  createdAt: string;
}

export interface Team {
  teamName: string;
  members: TeamMember[];
}

export interface TeamMember {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string;
  role: string;
}

export interface Attendance {
  id: string;
  userId: string;
  date: string;
  loginTime: string | null;
  logoutTime: string | null;
  pauseTime: string | null;
  resumeTime: string | null;
  status: 'present' | 'absent' | 'leave' | 'holiday' | 'on_break' | 'work_end' | 'half_day';
  workingHours: number | null;
  overtimeHours: number | null;
  breakMinutes: number | null;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  progress: number;
  estimatedHours: number | null;
  actualHours: number | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  assignees?: TaskAssignee[];
  comments?: TaskComment[];
}

export interface TaskAssignee {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  comment: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface WorkPlan {
  id: string;
  userId: string;
  date: string;
  plannedWork: string;
  priority: 'low' | 'medium' | 'high';
  estimatedHours: number | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  reviewComment: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface WorkReport {
  id: string;
  userId: string;
  date: string;
  completedWork: string;
  progressPercent: number | null;
  pendingWork: string | null;
  blockers: string | null;
  tomorrowPlan: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  reviewComment: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface Leave {
  id: string;
  userId: string;
  type: 'sick' | 'casual' | 'paid' | 'other';
  startDate: string;
  endDate: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy: string | null;
  reviewComment: string | null;
  workingDays: number;
  createdAt: string;
}

export interface LeaveBalance {
  sick: number;
  casual: number;
  paid: number;
  total: number;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'public' | 'optional' | 'company';
  appliesTo: 'all' | 'specific';
  createdBy: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: string | null;
  newValues: string | null;
  ipAddress: string | null;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UsersResponse {
  users: User[];
  total: number;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  dbMigrationVersion: number;
}

export interface ReadyResponse {
  status: 'ready' | 'not ready';
  timestamp: string;
  checks: {
    database: 'ok' | 'error';
    websocket: 'ok' | 'error';
  };
}

export interface AttendanceStats {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  holidayDays: number;
  totalWorkingHours: number;
  totalOvertimeHours: number;
  averageWorkingHours: number;
}

export interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
}

export interface DepartmentStats {
  totalDepartments: number;
  departments: Array<{
    name: string;
    employeeCount: number;
    attendanceRate: number;
  }>;
}

export interface AnalyticsAttendanceTrend {
  date: string;
  present: number;
  absent: number;
  leave: number;
  holiday: number;
}

export interface AnalyticsLeaveUsage {
  month: string;
  sick: number;
  casual: number;
  paid: number;
  other: number;
}

export interface SystemDbOverview {
  tables: Record<string, number>;
  journalMode: string;
  migrationVersion: number;
  fileSize: string;
}

export interface BackupInfo {
  filename: string;
  size: number;
  createdAt: string;
}
