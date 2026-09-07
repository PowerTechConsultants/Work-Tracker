import { z } from 'zod';

export const createHolidaySchema = z.object({
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  name: z.string().trim().min(1, 'Holiday name is required').max(200),
  type: z.enum(['public', 'custom']).default('public'),
  userIds: z.array(z.string().trim().uuid()).optional(),
});

export const listHolidaysSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const deleteHolidaySchema = z.object({
  confirm: z.enum(['DELETE']).optional(),
});

export type DeleteHolidayInput = z.infer<typeof deleteHolidaySchema>;
