import { Router, type IRouter } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import * as c from './network.controller.js';

const router: IRouter = Router();

router.use(requireAuth);

router.get('/', c.listNetworks);
router.get('/:id', c.getNetwork);
router.post('/', requireAdmin, c.createNetwork);
router.patch('/:id', requireAdmin, c.updateNetwork);
router.delete('/:id', requireAdmin, c.deleteNetwork);

export default router;
