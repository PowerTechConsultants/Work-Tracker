import { z } from 'zod';

export const createReportSchema = z.object({
  date: z.string().datetime('Invalid date format'),
  workCompletedToday: z.string().min(1, 'Work completed is required').max(5000, 'Work completed too long'),
  currentProgress: z.number().min(0, 'Progress must be between 0-100').max(100, 'Progress must be between 0-100').default(0),
  pendingWork: z.string().max(2000, 'Pending work too long').optional(),
  blockers: z.string().max(2000, 'Blockers description too long').optional(),
  tomorrowPlan: z.string().max(2000, 'Tomorrow plan too long').optional(),
});

export const updateReportSchema = z.object({
  workCompletedToday: z.string().min(1, 'Work completed is required').max(5000, 'Work completed too long').optional(),
  currentProgress: z.number().min(0, 'Progress must be between 0-100').max(100, 'Progress must be between 0-100').optional(),
  pendingWork: z.string().max(2000, 'Pending work too long').optional(),
  blockers: z.string().max(2000, 'Blockers description too long').optional(),
  tomorrowPlan: z.string().max(2000, 'Tomorrow plan too long').optional(),
  status: z.enum(['draft', 'submitted', 'reviewed', 'approved', 'rejected']).optional(),
});

export const listReportsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['draft', 'submitted', 'reviewed', 'approved', 'rejected']).optional(),
});

export const reviewReportSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  feedback: z.string().optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type ListReportsInput = z.infer<typeof listReportsSchema>;
