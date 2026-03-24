import { Router, type IRouter } from 'express';
import * as c from './rack.controller.js';
import { requireAuth, requireTech, requireAdmin } from '../../middleware/auth.middleware.js';

const router: IRouter = Router();

router.use(requireAuth, requireTech);

router.get('/by-asset/:assetId', c.getMountsByAsset);
router.get('/', c.listRacks);
router.post('/', requireAdmin, c.createRack);
router.get('/:id', c.getRack);
router.patch('/:id', requireAdmin, c.updateRack);
router.delete('/:id', requireAdmin, c.deleteRack);

router.post('/:id/mounts', requireAdmin, c.addMount);
router.patch('/:id/mounts/:mountId', requireAdmin, c.updateMount);
router.delete('/:id/mounts/:mountId', requireAdmin, c.removeMount);

export default router;
