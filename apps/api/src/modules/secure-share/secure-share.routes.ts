import { Router, type IRouter, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { AppError } from '../../middleware/error.middleware.js';
import { createShare, viewShare } from './secure-share.service.js';
import { User } from '../users/user.model.js';

const router: IRouter = Router();

// ── Create a share (authenticated) ───────────────────────────────────────────

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { contentType, credentialId, content, recipientEmail, expiresInHours, viewLimit } = req.body as Record<string, string>;

  if (!recipientEmail) throw new AppError(400, 'Recipient email required');
  if (contentType !== 'credential' && contentType !== 'note') throw new AppError(400, 'Invalid content type');

  const userDoc = await User.findById(user.id).select('displayName');
  const createdByName = userDoc?.displayName ?? 'IT Staff';

  const result = await createShare({
    contentType,
    credentialId: credentialId || undefined,
    content: content || undefined,
    recipientEmail,
    expiresInHours: Number(expiresInHours) || 24,
    viewLimit: Number(viewLimit) || 1,
    createdBy: user.id,
    createdByName,
  });

  res.json(result);
});

// ── View a share (public — no auth required) ──────────────────────────────────

router.get('/:token', async (req: Request, res: Response) => {
  const result = await viewShare(String(req.params['token']));

  if ('error' in result) {
    const messages: Record<string, string> = {
      not_found:    'This link does not exist.',
      destroyed:    'This content has already been viewed and the link has been destroyed.',
      expired:      'This link has expired.',
      limit_reached: 'This link has reached its maximum number of views.',
    };
    res.status(410).json({ error: result.error, message: messages[result.error] });
    return;
  }

  res.json(result);
});

export default router;
