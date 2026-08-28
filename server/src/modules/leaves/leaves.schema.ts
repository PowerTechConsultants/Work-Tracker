import { z } from 'zod';

export const createLeaveSchema = z.object({
  type: z.enum(['casual', 'sick', 'paid']),
  startDate: z.string().datetime('Invalid start date format'),
  endDate: z.string().datetime('Invalid end date format'),
  reason: z.string().min(1, 'Reason is required').max(2000, 'Reason too long').optional(),
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end >= start;
}, { message: 'End date must be after or equal to start date', path: ['endDate'] })
.refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff <= 365;
}, { message: 'Leave duration cannot exceed 1 year', path: ['endDate'] });

export const listLeavesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().min(1).optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  statuses: z.array(z.enum(['pending', 'approved', 'rejected', 'cancelled'])).optional(),
  type: z.enum(['casual', 'sick', 'paid']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const reviewLeaveSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewComment: z.string().optional(),
});

export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;
export type ListLeavesInput = z.infer<typeof listLeavesSchema>;
