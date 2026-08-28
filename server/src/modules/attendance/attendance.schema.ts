import { z } from 'zod';

const attendanceStatuses = ['present', 'on_break', 'work_end', 'absent', 'leave', 'half_day', 'holiday', 'remote'] as const;

export const checkInSchema = z.object({
  status: z.enum(attendanceStatuses).default('present'),
  notes: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).optional(),
  locationCapturedAt: z.string().datetime().optional(),
});

export const locationOptionalSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).optional(),
  locationCapturedAt: z.string().datetime().optional(),
});

export const monthlyQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).default(new Date().getFullYear()),
  month: z.coerce.number().int().min(1).max(12).default(new Date().getMonth() + 1),
  userId: z.string().optional(),
});

export const listAttendanceSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().min(1).optional(),
  userIds: z.preprocess(
    (val) => (val === undefined || val === null ? val : Array.isArray(val) ? val : [val]),
    z.array(z.string().min(1)).optional()
  ),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(attendanceStatuses).optional(),
});

export const updateAttendanceSchema = z.object({
  status: z.enum(attendanceStatuses).optional(),
  loginTime: z.string().datetime().optional(),
  logoutTime: z.string().datetime().optional(),
  workingHours: z.number().min(0).optional(),
  overtimeHours: z.number().min(0).optional(),
  pauseStartTime: z.string().datetime().optional(),
  pauseEndTime: z.string().datetime().optional(),
  pauseMinutes: z.number().min(0).optional(),
  notes: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).optional(),
  locationCapturedAt: z.string().datetime().optional(),
});

export const deleteAttendanceSchema = z.object({
  userId: z.string().min(1).optional(),
  userIds: z.preprocess(
    (val) => (val === undefined || val === null ? val : Array.isArray(val) ? val : [val]),
    z.array(z.string().min(1)).optional()
  ),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  date: z.string().optional(),
  status: z.enum(attendanceStatuses).optional(),
  statuses: z.preprocess(
    (val) => (val === undefined || val === null ? val : Array.isArray(val) ? val : [val]),
    z.array(z.enum(attendanceStatuses)).optional()
  ),
  confirm: z.enum(['DELETE']).optional(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
export type ListAttendanceInput = z.infer<typeof listAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type DeleteAttendanceInput = z.infer<typeof deleteAttendanceSchema>;
