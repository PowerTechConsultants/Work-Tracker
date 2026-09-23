import { z } from 'zod';
export const createReportSchema = z.object({
    date: z.string().trim().datetime('Invalid date format'),
    workCompletedToday: z.string().trim().min(1, 'Work completed is required').max(5000, 'Work completed too long'),
    currentProgress: z.number().min(0, 'Progress must be between 0-100').max(100, 'Progress must be between 0-100').default(0),
    pendingWork: z.string().trim().max(2000, 'Pending work too long').optional(),
    blockers: z.string().trim().max(2000, 'Blockers description too long').optional(),
    tomorrowPlan: z.string().trim().max(2000, 'Tomorrow plan too long').optional(),
});
export const updateReportSchema = z.object({
    workCompletedToday: z.string().trim().min(1, 'Work completed is required').max(5000, 'Work completed too long').optional(),
    currentProgress: z.number().min(0, 'Progress must be between 0-100').max(100, 'Progress must be between 0-100').optional(),
    pendingWork: z.string().trim().max(2000, 'Pending work too long').optional(),
    blockers: z.string().trim().max(2000, 'Blockers description too long').optional(),
    tomorrowPlan: z.string().trim().max(2000, 'Tomorrow plan too long').optional(),
});
export const listReportsSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    userId: z.string().trim().min(1).optional(),
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
    status: z.enum(['draft', 'submitted', 'reviewed', 'approved', 'rejected']).optional(),
});
export const reviewReportSchema = z.object({
    status: z.enum(['approved', 'rejected']),
    feedback: z.string().trim().optional(),
});
