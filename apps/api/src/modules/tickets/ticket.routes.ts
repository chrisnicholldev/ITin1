import { Router, type IRouter } from 'express';
import * as c from './ticket.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router: IRouter = Router();

router.use(requireAuth);

router.get('/', c.listTickets);
router.post('/', c.createTicket);
router.get('/:id', c.getTicket);
router.patch('/:id', c.updateTicket);
router.post('/:id/comments', c.addComment);
router.delete('/:id/comments/:commentId', c.deleteComment);

export default router;
