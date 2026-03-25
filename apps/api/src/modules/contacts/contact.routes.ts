import { Router, type Router as ExpressRouter } from 'express';
import { requireAuth, requireTech } from '../../middleware/auth.middleware.js';
import { listContacts } from './contact.controller.js';

const router: ExpressRouter = Router();

router.use(requireAuth, requireTech);
router.get('/', listContacts);

export default router;
