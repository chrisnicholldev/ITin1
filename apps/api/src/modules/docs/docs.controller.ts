import type { Request, Response } from 'express';
import * as service from './docs.service.js';
import { CreateDocFolderSchema, UpdateDocFolderSchema, CreateArticleSchema, UpdateArticleSchema } from '@itdesk/shared';
import { AppError } from '../../middleware/error.middleware.js';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { sendMail } from '../../lib/mailer.js';
import { env } from '../../config/env.js';

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

export async function shareArticle(req: Request, res: Response) {
  const { to, note } = req.body as { to?: string; note?: string };
  if (!to) throw new AppError(400, 'Recipient email required');

  const article = await service.getArticle(String(req.params['slug']));
  if (!article) throw new AppError(404, 'Article not found');

  const sender = (req as AuthenticatedRequest).user;
  const articleUrl = `${env.CLIENT_URL}/docs/articles/${article.slug}`;
  const excerpt = article.bodyText ? article.bodyText.slice(0, 300).trim() + (article.bodyText.length > 300 ? '…' : '') : '';

  const noteBlock = note?.trim()
    ? `<div style="background:#f4f4f5;border-left:3px solid #18181b;padding:12px 16px;margin-bottom:20px;border-radius:0 4px 4px 0;font-size:14px;color:#3f3f46">${note.trim()}</div>`
    : '';

  const html = `<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#18181b;padding:20px 28px">
      <span style="color:#fff;font-size:18px;font-weight:600">IT Helpdesk</span>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 8px;font-size:18px;color:#18181b">${article.title}</h2>
      <p style="margin:0 0 20px;font-size:13px;color:#71717a">${sender.displayName} shared a knowledge base article with you.</p>
      ${noteBlock}
      ${excerpt ? `<p style="font-size:14px;color:#3f3f46;margin:0 0 20px">${excerpt}</p>` : ''}
      <a href="${articleUrl}" style="display:inline-block;padding:10px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">View Article</a>
    </div>
    <div style="padding:16px 28px;background:#f4f4f5;font-size:12px;color:#71717a">This is an automated message — please do not reply directly to this email.</div>
  </div>
</body></html>`;

  try {
    await sendMail(to, `KB: ${article.title}`, html);
    res.json({ ok: true });
  } catch (err: any) {
    throw new AppError(500, err?.message ?? 'Failed to send email');
  }
}
