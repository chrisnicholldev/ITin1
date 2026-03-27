import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { getDashboardStats } from './dashboard.service.js';

export async function getStats(req: Request, res: Response) {
  const { role } = (req as AuthenticatedRequest).user;
  const stats = await getDashboardStats(role);
  res.json(stats);
}
