import mongoose from 'mongoose';
import { ChangelogEntry, type IChangelogEntryDocument } from './changelog.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type { CreateChangelogEntryInput, UpdateChangelogEntryInput } from '@itdesk/shared';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toResponse(doc: IChangelogEntryDocument) {
  const obj = doc.toObject({ virtuals: true });
  return {
    id:              doc.id as string,
    title:           doc.title,
    category:        doc.category,
    description:     doc.description,
    performedBy:     doc.performedBy,
    occurredAt:      doc.occurredAt.toISOString(),
    affectedSystems: doc.affectedSystems ?? [],
    tags:            doc.tags ?? [],
    rollbackNotes:   doc.rollbackNotes,
    createdBy:       obj.createdBy
      ? { id: obj.createdBy._id?.toString() ?? obj.createdBy.id, displayName: obj.createdBy.displayName }
      : undefined,
    createdAt:       doc.createdAt.toISOString(),
    updatedAt:       doc.updatedAt.toISOString(),
  };
}

// ── Service functions ─────────────────────────────────────────────────────────

export async function listEntries(query: {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const filter: Record<string, unknown> = {};
  if (query.category) filter['category'] = query.category;
  if (query.search)   filter['$text']    = { $search: query.search };

  const page  = query.page  ?? 1;
  const limit = query.limit ?? 50;

  const [docs, total] = await Promise.all([
    ChangelogEntry.find(filter)
      .populate('createdBy', 'displayName')
      .sort(query.search ? { score: { $meta: 'textScore' } } : { occurredAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit) as Promise<IChangelogEntryDocument[]>,
    ChangelogEntry.countDocuments(filter),
  ]);

  return {
    data: docs.map(toResponse),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

export async function getEntry(id: string) {
  const doc = await ChangelogEntry.findById(id)
    .populate('createdBy', 'displayName') as IChangelogEntryDocument | null;
  if (!doc) throw new AppError(404, 'Entry not found');
  return toResponse(doc);
}

export async function createEntry(input: CreateChangelogEntryInput, userId: string) {
  const occurredAt = input.occurredAt && input.occurredAt !== ''
    ? new Date(input.occurredAt)
    : new Date();

  const doc = await ChangelogEntry.create({
    title:           input.title,
    category:        input.category,
    description:     input.description,
    performedBy:     input.performedBy,
    occurredAt,
    affectedSystems: input.affectedSystems ?? [],
    tags:            input.tags ?? [],
    rollbackNotes:   input.rollbackNotes,
    createdBy:       new mongoose.Types.ObjectId(userId),
  }) as IChangelogEntryDocument;
  return getEntry(String(doc._id));
}

export async function updateEntry(id: string, input: UpdateChangelogEntryInput) {
  const updates: Record<string, unknown> = {};
  if (input.title           !== undefined) updates['title']           = input.title;
  if (input.category        !== undefined) updates['category']        = input.category;
  if (input.description     !== undefined) updates['description']     = input.description;
  if (input.performedBy     !== undefined) updates['performedBy']     = input.performedBy;
  if (input.occurredAt      !== undefined && input.occurredAt !== '') updates['occurredAt'] = new Date(input.occurredAt);
  if (input.affectedSystems !== undefined) updates['affectedSystems'] = input.affectedSystems;
  if (input.tags            !== undefined) updates['tags']            = input.tags;
  if (input.rollbackNotes   !== undefined) updates['rollbackNotes']   = input.rollbackNotes;

  const doc = await ChangelogEntry.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true })
    .populate('createdBy', 'displayName') as IChangelogEntryDocument | null;
  if (!doc) throw new AppError(404, 'Entry not found');
  return toResponse(doc);
}

export async function deleteEntry(id: string) {
  const doc = await ChangelogEntry.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, 'Entry not found');
}
