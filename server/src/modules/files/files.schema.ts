import { z } from 'zod';

export const uploadFileSchema = z.object({});

export const listFilesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().trim().optional(),
  mimeType: z.string().trim().optional(),
});
