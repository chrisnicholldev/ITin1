import { z } from 'zod';
import { AuthProvider, UserRole } from '../enums/index.js';

export const UserRoleSchema = z.enum([
  UserRole.END_USER,
  UserRole.IT_TECHNICIAN,
  UserRole.IT_ADMIN,
  UserRole.SUPER_ADMIN,
]);

export const AuthProviderSchema = z.enum([AuthProvider.LDAP, AuthProvider.LOCAL]);

export const CreateUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
  username: z.string().min(1).max(100),
  password: z.string().min(8).optional(),
  role: UserRoleSchema.default(UserRole.END_USER),
  department: z.string().max(100).optional(),
  title: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
});

export const UpdateUserSchema = CreateUserSchema.partial().omit({ password: true });

export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  username: z.string(),
  role: UserRoleSchema,
  authProvider: AuthProviderSchema,
  department: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().optional(),
  isActive: z.boolean(),
  lastLogin: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
