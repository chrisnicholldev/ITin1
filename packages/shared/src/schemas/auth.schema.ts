import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const TokenResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
