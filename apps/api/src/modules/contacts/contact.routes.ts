import { Router, type Router as ExpressRouter } from 'express';
import { requireAuth, requireTech } from '../../middleware/auth.middleware.js';
import { getContacts, createContact, updateContact, deleteContact } from './contact.controller.js';

const router: ExpressRouter = Router();

router.use(requireAuth, requireTech);

router.get('/', getContacts);
router.post('/', createContact);
router.patch('/:id', updateContact);
router.delete('/:id', deleteContact);

export default router;
