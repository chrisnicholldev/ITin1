import { Router } from 'express';
import * as c from './location.controller.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);
router.get('/', c.listLocations);
router.post('/', requireAdmin, c.createLocation);
router.patch('/:id', requireAdmin, c.updateLocation);
router.delete('/:id', requireAdmin, c.deleteLocation);
export default router;
