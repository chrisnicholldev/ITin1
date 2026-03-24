import { Router, type IRouter } from 'express';
import * as c from './category.controller.js';
import { requireAuth, requireTech, requireAdmin } from '../../middleware/auth.middleware.js';

const router: IRouter = Router();

router.use(requireAuth);

router.get('/', requireTech, c.listCategories);
router.post('/', requireAdmin, c.createCategory);
router.patch('/:id', requireAdmin, c.updateCategory);
router.delete('/:id', requireAdmin, c.deleteCategory);

export default router;
