import { Router, type IRouter } from 'express';
import * as c from './vault.controller.js';
import { requireAuth, requireTech, requireAdmin } from '../../middleware/auth.middleware.js';

const router: IRouter = Router();

// All vault routes require at least technician role
router.use(requireAuth, requireTech);

// Audit log — admin only
router.get('/audit', requireAdmin, c.getAuditLog);

// Credential CRUD
router.get('/', c.listCredentials);
router.post('/', requireAdmin, c.createCredential);
router.get('/:id', c.getCredential);
router.patch('/:id', requireAdmin, c.updateCredential);
router.delete('/:id', requireAdmin, c.deleteCredential);

// Reveal / copy (all techs+)
router.post('/:id/reveal', c.revealPassword);
router.post('/:id/copy', c.copyPassword);

export default router;
