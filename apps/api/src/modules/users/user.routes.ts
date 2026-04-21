import { Router, type IRouter } from 'express';
import * as c from './user.controller.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';

const router: IRouter = Router();

router.use(requireAuth);

router.get('/me', c.getMe);
router.patch('/me', c.updateMe);
router.patch('/me/notification-preferences', c.updateNotificationPreferences);
router.get('/', requireAdmin, c.listUsers);
router.post('/', requireAdmin, c.createUser);
router.get('/:id', requireAdmin, c.getUser);
router.patch('/:id', requireAdmin, c.updateUser);
router.post('/:id/reset-password', requireAdmin, c.resetPassword);
router.post('/:id/reactivate', requireAdmin, c.reactivateUser);
router.delete('/:id', requireAdmin, c.deactivateUser);

export default router;
