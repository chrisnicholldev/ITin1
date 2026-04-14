import { Router, type IRouter } from 'express';
import * as c from './asset.controller.js';
import { requireAuth, requireTech, requireAdmin } from '../../middleware/auth.middleware.js';

const router: IRouter = Router();

router.use(requireAuth, requireTech);

router.get('/report/summary', c.getSummary);
router.get('/', c.listAssets);
router.post('/', c.createAsset);
router.post('/import', requireAdmin, c.importAssets);
router.get('/:id', c.getAsset);
router.patch('/:id', c.updateAsset);
router.delete('/:id', c.deactivateAsset);

export default router;
