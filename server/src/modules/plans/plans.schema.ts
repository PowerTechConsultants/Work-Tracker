import { z } from 'zod';

export const createPlanSchema = z.object({
  date: z.string().datetime('Invalid date format'),
  plannedWork: z.string().min(1, 'Planned work is required').max(5000, 'Planned work too long'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  estimatedHours: z.number().min(0, 'Hours must be positive').max(24, 'Hours cannot exceed 24 for a day').optional(),
});

export const updatePlanSchema = z.object({
  plannedWork: z.string().min(1, 'Planned work is required').max(5000, 'Planned work too long').optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  estimatedHours: z.number().min(0, 'Hours must be positive').max(24, 'Hours cannot exceed 24 for a day').optional(),
  status: z.enum(['draft', 'submitted', 'reviewed', 'approved', 'rejected']).optional(),
});

export const listPlansSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['draft', 'submitted', 'reviewed', 'approved', 'rejected']).optional(),
});

export const reviewPlanSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewComment: z.string().optional(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type ListPlansInput = z.infer<typeof listPlansSchema>;
