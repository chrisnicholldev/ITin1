import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../config/jwt.js';
import { UserRole } from '@itdesk/shared';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: string;
  };
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyAccessToken(token);
    (req as AuthenticatedRequest).user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export const requireAdmin = requireRole(UserRole.IT_ADMIN, UserRole.SUPER_ADMIN);
export const requireTech = requireRole(
  UserRole.IT_TECHNICIAN,
  UserRole.IT_ADMIN,
  UserRole.SUPER_ADMIN,
);
