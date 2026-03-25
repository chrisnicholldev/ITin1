import type { Request, Response } from 'express';
import * as service from './docs.service.js';
import { CreateDocFolderSchema, UpdateDocFolderSchema, CreateArticleSchema, UpdateArticleSchema } from '@itdesk/shared';
import { AppError } from '../../middleware/error.middleware.js';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

function userId(req: Request) { return (req as AuthenticatedRequest).user.id; }

// ── Folders ───────────────────────────────────────────────────────────────────

export async function listFolders(_req: Request, res: Response) {
  res.json(await service.listFolders());
}

export async function createFolder(req: Request, res: Response) {
  const parsed = CreateDocFolderSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Validation error: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
  res.status(201).json(await service.createFolder(parsed.data, userId(req)));
}

export async function updateFolder(req: Request, res: Response) {
  const parsed = UpdateDocFolderSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Validation error: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
  res.json(await service.updateFolder(String(req.params['id']), parsed.data));
}

export async function deleteFolder(req: Request, res: Response) {
  await service.deleteFolder(String(req.params['id']));
  res.status(204).end();
}

// ── Articles ──────────────────────────────────────────────────────────────────

export async function listArticles(req: Request, res: Response) {
  const { folderId, tag, locationId, search, page, limit } = req.query as Record<string, string>;
  const user = (req as AuthenticatedRequest).user;
  const isAdmin = user.role === 'it_admin' || user.role === 'super_admin';
  res.json(await service.listArticles({
    folderId,
    tag,
    locationId,
    search,
    drafts: isAdmin,
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 30,
  }));
}

export async function getArticle(req: Request, res: Response) {
  res.json(await service.getArticle(String(req.params['slug'])));
}

export async function createArticle(req: Request, res: Response) {
  const parsed = CreateArticleSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Validation error: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
  res.status(201).json(await service.createArticle(parsed.data, userId(req)));
}

export async function updateArticle(req: Request, res: Response) {
  const parsed = UpdateArticleSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Validation error: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
  res.json(await service.updateArticle(String(req.params['slug']), parsed.data, userId(req)));
}

export async function deleteArticle(req: Request, res: Response) {
  await service.deleteArticle(String(req.params['slug']));
  res.status(204).end();
}
