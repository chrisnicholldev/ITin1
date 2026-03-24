import type { Request, Response } from 'express';
import { loginLocal, loginLdap, refreshTokens, logout } from './auth.service.js';
import { User } from '../users/user.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { env } from '../../config/env.js';
import { LoginSchema } from '@itdesk/shared';

const REFRESH_COOKIE = 'refresh_token';

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/api/v1/auth',
};

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = LoginSchema.parse(req.body);

  let tokens: { accessToken: string; refreshToken: string };

  if (env.LDAP_ENABLED) {
    try {
      tokens = await loginLdap(username, password);
    } catch {
      // Fall back to local auth
      tokens = await loginLocal(username, password);
    }
  } else {
    tokens = await loginLocal(username, password);
  }

  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
  res.json({ accessToken: tokens.accessToken, expiresIn: 15 * 60 });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies[REFRESH_COOKIE] as string | undefined;
  if (!token) throw new AppError(401, 'No refresh token');

  const tokens = await refreshTokens(token);

  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
  res.json({ accessToken: tokens.accessToken, expiresIn: 15 * 60 });
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const user = (req as AuthenticatedRequest).user;
  await logout(user.id);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  const { id } = (req as AuthenticatedRequest).user;
  const user = await User.findById(id);
  if (!user) throw new AppError(404, 'User not found');

  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    username: user.username,
    role: user.role,
    authProvider: user.authProvider,
    department: user.department,
    title: user.title,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
}
