import { Router, type IRouter } from 'express';
import * as c from './docs.controller.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';

const router: IRouter = Router();
router.use(requireAuth);

// Folders
router.get('/folders', c.listFolders);
router.post('/folders', requireAdmin, c.createFolder);
router.patch('/folders/:id', requireAdmin, c.updateFolder);
router.delete('/folders/:id', requireAdmin, c.deleteFolder);

// Articles
router.get('/articles', c.listArticles);
router.post('/articles', requireAdmin, c.createArticle);
router.get('/articles/:slug', c.getArticle);
router.post('/articles/:slug/share', c.shareArticle);
router.patch('/articles/:slug', requireAdmin, c.updateArticle);
router.delete('/articles/:slug', requireAdmin, c.deleteArticle);

export default router;
