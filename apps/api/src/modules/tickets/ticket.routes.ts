import { Router, type IRouter } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as c from './ticket.controller.js';
import { requireAuth, requireTech } from '../../middleware/auth.middleware.js';
import { env } from '../../config/env.js';

const router: IRouter = Router();

const ticketStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.resolve(env.UPLOAD_DIR, 'tickets');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  },
});

const upload = multer({
  storage: ticketStorage,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
});

router.use(requireAuth);

router.get('/', c.listTickets);
router.post('/bulk', requireTech, c.bulkUpdate);
router.get('/reports', requireTech, c.getReports);
router.post('/', c.createTicket);
router.get('/:id/history', c.getHistory);
router.get('/:id', c.getTicket);
router.patch('/:id', c.updateTicket);
router.post('/:id/comments', c.addComment);
router.delete('/:id/comments/:commentId', c.deleteComment);
router.post('/:id/attachments', upload.single('file'), c.uploadAttachment);
router.delete('/:id/attachments/:aid', c.deleteAttachment);

export default router;
