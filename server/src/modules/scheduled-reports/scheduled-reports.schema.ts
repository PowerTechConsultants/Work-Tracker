import { z } from 'zod';

export const createScheduleSchema = z.object({
  templateId: z.string().trim().min(1, 'Template ID is required'),
  recipients: z.array(z.string().trim().min(1)).default([]),
  scheduleCron: z.string().trim().min(1, 'Schedule cron expression is required'),
  format: z.enum(['pdf', 'excel', 'csv']).default('pdf'),
  isActive: z.boolean().default(true),
});

export const updateScheduleSchema = createScheduleSchema.partial();

export const listSchedulesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type ListSchedulesInput = z.infer<typeof listSchedulesSchema>;
