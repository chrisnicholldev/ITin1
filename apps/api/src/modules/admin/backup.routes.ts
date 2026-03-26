import { Router, type IRouter } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import * as c from './backup.controller.js';

const router: IRouter = Router();

router.use(requireAuth, requireAdmin);

router.get('/backup', c.downloadBackup);
router.post('/restore', c.uploadRestore);

export default router;
