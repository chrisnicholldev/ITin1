import mongoose from 'mongoose';
import { DocFolder, type IDocFolderDocument } from './doc-folder.model.js';
import { Article, type IArticleDocument } from './article.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type { CreateDocFolderInput, UpdateDocFolderInput, CreateArticleInput, UpdateArticleInput } from '@itdesk/shared';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

async function uniqueSlug(title: string): Promise<string> {
  const base = toSlug(title);
  let slug = base;
  let n = 1;
  while (await Article.exists({ slug })) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

/** Recursively extract plain text from TipTap JSON for full-text search */
function extractBodyText(body: string): string {
  try {
    const node = JSON.parse(body);
    const parts: string[] = [];
    function walk(n: any) {
      if (n?.type === 'text' && n.text) parts.push(n.text);
      if (Array.isArray(n?.content)) n.content.forEach(walk);
    }
    walk(node);
    return parts.join(' ');
  } catch {
    return body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

function folderToResponse(doc: IDocFolderDocument, articleCount = 0) {
  return {
    id: doc.id as string,
    name: doc.name,
    description: doc.description,
    icon: doc.icon,
    sortOrder: doc.sortOrder,
    articleCount,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function articleToResponse(doc: IArticleDocument) {
  const obj = doc.toObject({ virtuals: true });
  return {
    id: doc.id as string,
    title: doc.title,
    slug: doc.slug,
    body: doc.body,
    folder: obj.folder
      ? { id: obj.folder._id?.toString() ?? obj.folder.id, name: obj.folder.name, icon: obj.folder.icon }
      : undefined,
    linkedAssets: (obj.linkedAssets ?? []).map((a: any) => ({
      id: a._id?.toString() ?? a.id ?? String(a),
      name: a.name ?? '',
      assetTag: a.assetTag ?? '',
    })),
    linkedLocation: obj.linkedLocation
      ? { id: obj.linkedLocation._id?.toString() ?? obj.linkedLocation.id, name: obj.linkedLocation.name }
      : undefined,
    tags: doc.tags,
    published: !!doc.publishedAt,
    publishedAt: doc.publishedAt?.toISOString(),
    createdBy: obj.createdBy
      ? { id: obj.createdBy._id?.toString() ?? obj.createdBy.id, displayName: obj.createdBy.displayName }
      : undefined,
    updatedBy: obj.updatedBy
      ? { id: obj.updatedBy._id?.toString() ?? obj.updatedBy.id, displayName: obj.updatedBy.displayName }
      : undefined,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// ── Folder operations ─────────────────────────────────────────────────────────

export async function listFolders() {
  const folders = await DocFolder.find().sort({ sortOrder: 1, name: 1 }) as IDocFolderDocument[];
  const counts = await Article.aggregate([
    { $group: { _id: '$folder', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c: any) => [String(c._id), c.count]));
  return folders.map((f) => folderToResponse(f, countMap[String(f._id)] ?? 0));
}

export async function createFolder(input: CreateDocFolderInput, userId: string) {
  const doc = await DocFolder.create({ ...input, createdBy: new mongoose.Types.ObjectId(userId) }) as IDocFolderDocument;
  return folderToResponse(doc, 0);
}

export async function updateFolder(id: string, input: UpdateDocFolderInput) {
  const doc = await DocFolder.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }) as IDocFolderDocument | null;
  if (!doc) throw new AppError(404, 'Folder not found');
  const count = await Article.countDocuments({ folder: doc._id });
  return folderToResponse(doc, count);
}

export async function deleteFolder(id: string) {
  const count = await Article.countDocuments({ folder: new mongoose.Types.ObjectId(id) });
  if (count > 0) throw new AppError(400, `Cannot delete folder with ${count} article${count !== 1 ? 's' : ''}. Move or delete articles first.`);
  const doc = await DocFolder.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, 'Folder not found');
}

// ── Article operations ────────────────────────────────────────────────────────

export async function listArticles(query: {
  folderId?: string;
  tag?: string;
  locationId?: string;
  search?: string;
  drafts?: boolean;
  page?: number;
  limit?: number;
}) {
  const filter: Record<string, unknown> = {};
  if (!query.drafts) filter['publishedAt'] = { $exists: true, $ne: null };
  if (query.folderId) filter['folder'] = new mongoose.Types.ObjectId(query.folderId);
  if (query.tag) filter['tags'] = query.tag;
  if (query.locationId) filter['linkedLocation'] = new mongoose.Types.ObjectId(query.locationId);
  if (query.search) filter['$text'] = { $search: query.search };

  const page = query.page ?? 1;
  const limit = query.limit ?? 30;

  const [docs, total] = await Promise.all([
    Article.find(filter)
      .populate('folder', 'name icon')
      .populate('linkedAssets', 'name assetTag')
      .populate('linkedLocation', 'name')
      .populate('createdBy', 'displayName')
      .populate('updatedBy', 'displayName')
      .sort(query.search ? { score: { $meta: 'textScore' } } : { updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit) as Promise<IArticleDocument[]>,
    Article.countDocuments(filter),
  ]);

  return {
    data: docs.map(articleToResponse),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

export async function getArticle(slug: string) {
  const doc = await Article.findOne({ slug })
    .populate('folder', 'name icon')
    .populate('linkedAssets', 'name assetTag')
    .populate('linkedLocation', 'name')
    .populate('createdBy', 'displayName')
    .populate('updatedBy', 'displayName') as IArticleDocument | null;
  if (!doc) throw new AppError(404, 'Article not found');
  return articleToResponse(doc);
}

export async function createArticle(input: CreateArticleInput, userId: string) {
  const slug = await uniqueSlug(input.title);
  const bodyText = extractBodyText(input.body);
  const doc = await Article.create({
    title: input.title,
    slug,
    body: input.body,
    bodyText,
    folder: new mongoose.Types.ObjectId(input.folderId),
    linkedAssets: (input.linkedAssets ?? []).map((id) => new mongoose.Types.ObjectId(id)),
    linkedLocation: input.linkedLocationId ? new mongoose.Types.ObjectId(input.linkedLocationId) : undefined,
    tags: input.tags ?? [],
    publishedAt: input.published ? new Date() : undefined,
    createdBy: new mongoose.Types.ObjectId(userId),
  }) as IArticleDocument;
  return getArticle(doc.slug);
}

export async function updateArticle(slug: string, input: UpdateArticleInput, userId: string) {
  const existing = await Article.findOne({ slug }) as IArticleDocument | null;
  if (!existing) throw new AppError(404, 'Article not found');

  const updates: Record<string, unknown> = { updatedBy: new mongoose.Types.ObjectId(userId) };
  if (input.title !== undefined) updates['title'] = input.title;
  if (input.body !== undefined) { updates['body'] = input.body; updates['bodyText'] = extractBodyText(input.body); }
  if (input.folderId !== undefined) updates['folder'] = new mongoose.Types.ObjectId(input.folderId);
  if (input.linkedAssets !== undefined) updates['linkedAssets'] = input.linkedAssets.map((id) => new mongoose.Types.ObjectId(id));
  if (input.linkedLocationId !== undefined) updates['linkedLocation'] = input.linkedLocationId ? new mongoose.Types.ObjectId(input.linkedLocationId) : null;
  if (input.tags !== undefined) updates['tags'] = input.tags;
  if (input.published !== undefined) {
    updates['publishedAt'] = input.published ? (existing.publishedAt ?? new Date()) : null;
  }

  await Article.findByIdAndUpdate(existing._id, { $set: updates });
  return getArticle(slug);
}

export async function deleteArticle(slug: string) {
  const doc = await Article.findOneAndDelete({ slug });
  if (!doc) throw new AppError(404, 'Article not found');
}
