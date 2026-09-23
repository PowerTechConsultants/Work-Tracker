import { z } from 'zod';
export const listNotificationsSchema = z.object({
    unread: z.preprocess((v) => v === 'true' || v === '1' || v === true || v === 1, z.boolean()).default(false),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
