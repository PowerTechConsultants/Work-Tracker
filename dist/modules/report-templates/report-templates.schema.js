import { z } from 'zod';
export const createTemplateSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(200, 'Name too long'),
    description: z.string().trim().max(2000, 'Description too long').optional(),
    type: z.enum(['daily', 'weekly', 'monthly', 'custom']).default('daily'),
    fields: z.array(z.object({
        key: z.string().trim().min(1),
        label: z.string().trim().min(1),
        type: z.enum(['text', 'number', 'date', 'select', 'textarea']).default('text'),
        required: z.boolean().default(false),
        options: z.array(z.string()).optional(),
    })).default([]),
    isDefault: z.boolean().default(false),
});
export const updateTemplateSchema = createTemplateSchema.partial();
export const listTemplatesSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
