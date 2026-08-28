import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long').regex(/[A-Z]/, 'Password must contain at least one uppercase letter').regex(/[a-z]/, 'Password must contain at least one lowercase letter').regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long').regex(/^[a-zA-Z\s'-]+$/, 'First name contains invalid characters'),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long').regex(/^[a-zA-Z\s'-]+$/, 'Last name contains invalid characters'),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional().or(z.literal('')),
  role: z.enum(['director', 'hr', 'employee']),
  departmentId: z.string().min(1, 'Invalid department ID').optional(),
  designation: z.string().max(100, 'Designation too long').optional(),
  joiningDate: z.string().datetime('Invalid date format').optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long').regex(/^[a-zA-Z\s'-]+$/, 'First name contains invalid characters').optional(),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long').regex(/^[a-zA-Z\s'-]+$/, 'Last name contains invalid characters').optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional().or(z.literal('')),
  role: z.enum(['director', 'hr', 'employee']).optional(),
  departmentId: z.string().min(1, 'Invalid department ID').nullable().optional(),
  designation: z.string().max(100, 'Designation too long').optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['director', 'hr', 'employee']).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  departmentId: z.string().min(1).optional(),
  search: z.string().max(200).optional(),
});

export const deleteUserSchema = z.object({
  confirm: z.enum(['DELETE']).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
