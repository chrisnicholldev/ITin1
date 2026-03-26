import { Router, type IRouter } from 'express';
import { requireAuth, requireTech, requireAdmin } from '../../middleware/auth.middleware.js';
import * as c from './vendor.controller.js';

const router: IRouter = Router();

router.use(requireAuth, requireTech);

router.get('/', c.listVendors);
router.get('/:id', c.getVendor);
router.post('/', requireAdmin, c.createVendor);
router.patch('/:id', requireAdmin, c.updateVendor);
router.delete('/:id', requireAdmin, c.deleteVendor);

// Contacts (nested)
router.post('/:id/contacts', requireAdmin, c.addContact);
router.patch('/:id/contacts/:contactId', requireAdmin, c.updateContact);
router.delete('/:id/contacts/:contactId', requireAdmin, c.deleteContact);

export default router;
