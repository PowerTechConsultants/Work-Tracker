import { z } from 'zod';

export const listActivityLogsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  actorId: z.string().min(1).optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

export type ListActivityLogsInput = z.infer<typeof listActivityLogsSchema>;
