import { z } from 'zod';
export const createPlanSchema = z.object({
    date: z.string().trim().datetime('Invalid date format'),
    plannedWork: z.string().trim().min(1, 'Planned work is required').max(5000, 'Planned work too long'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    estimatedHours: z.number().min(0, 'Hours must be positive').max(24, 'Hours cannot exceed 24 for a day').optional(),
});
export const updatePlanSchema = z.object({
    plannedWork: z.string().trim().min(1, 'Planned work is required').max(5000, 'Planned work too long').optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    estimatedHours: z.number().min(0, 'Hours must be positive').max(24, 'Hours cannot exceed 24 for a day').optional(),
});
export const listPlansSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    userId: z.string().trim().min(1).optional(),
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
    status: z.enum(['draft', 'submitted', 'reviewed', 'approved', 'rejected']).optional(),
});
export const reviewPlanSchema = z.object({
    status: z.enum(['approved', 'rejected']),
    reviewComment: z.string().trim().optional(),
});
