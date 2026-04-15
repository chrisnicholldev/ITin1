import mongoose from 'mongoose';
import {
  ChecklistTemplate, ChecklistRun,
  type IChecklistTemplateDocument, type IChecklistRunDocument,
} from './checklist.model.js';
import { User } from '../users/user.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type {
  CreateChecklistTemplateInput, UpdateChecklistTemplateInput,
  CreateChecklistRunInput, UpdateChecklistRunInput,
} from '@itdesk/shared';

// ── Response mappers ──────────────────────────────────────────────────────────

function templateToResponse(doc: IChecklistTemplateDocument) {
  return {
    id:          doc.id as string,
    name:        doc.name,
    type:        doc.type,
    description: doc.description,
    items:       doc.items.map((item) => ({
      id:          item._id.toString(),
      title:       item.title,
      description: item.description,
      category:    item.category,
      required:    item.required,
    })),
    itemCount:   doc.items.length,
    createdAt:   doc.createdAt.toISOString(),
    updatedAt:   doc.updatedAt.toISOString(),
  };
}

function progress(items: IChecklistRunDocument['items']) {
  const total             = items.length;
  const completed         = items.filter((i) => i.completed).length;
  const required          = items.filter((i) => i.required).length;
  const requiredCompleted = items.filter((i) => i.required && i.completed).length;
  return { completed, total, required, requiredCompleted };
}

function runToResponse(doc: IChecklistRunDocument) {
  const obj = doc.toObject({ virtuals: true });
  return {
    id:                 doc.id as string,
    templateName:       doc.templateName,
    type:               doc.type,
    employeeName:       doc.employeeName,
    employeeDepartment: doc.employeeDepartment,
    assignedTo:         doc.assignedTo,
    dueDate:            doc.dueDate?.toISOString(),
    notes:              doc.notes,
    status:             doc.status,
    completedAt:        doc.completedAt?.toISOString(),
    progress:           progress(doc.items),
    items:              doc.items.map((item) => ({
      id:          item._id.toString(),
      title:       item.title,
      description: item.description,
      category:    item.category,
      required:    item.required,
      completed:   item.completed,
      completedAt: item.completedAt?.toISOString(),
      completedBy: item.completedBy,
      notes:       item.notes,
    })),
    createdBy:          obj.createdBy
      ? { id: obj.createdBy._id?.toString() ?? obj.createdBy.id, displayName: obj.createdBy.displayName }
      : undefined,
    createdAt:          doc.createdAt.toISOString(),
    updatedAt:          doc.updatedAt.toISOString(),
  };
}

// ── Template CRUD ─────────────────────────────────────────────────────────────

export async function listTemplates() {
  const docs = await ChecklistTemplate.find().sort({ type: 1, name: 1 }) as IChecklistTemplateDocument[];
  return docs.map(templateToResponse);
}

export async function getTemplate(id: string) {
  const doc = await ChecklistTemplate.findById(id) as IChecklistTemplateDocument | null;
  if (!doc) throw new AppError(404, 'Template not found');
  return templateToResponse(doc);
}

export async function createTemplate(input: CreateChecklistTemplateInput, userId: string) {
  const doc = await ChecklistTemplate.create({
    name:        input.name,
    type:        input.type,
    description: input.description,
    items:       input.items,
    createdBy:   new mongoose.Types.ObjectId(userId),
  }) as IChecklistTemplateDocument;
  return templateToResponse(doc);
}

export async function updateTemplate(id: string, input: UpdateChecklistTemplateInput) {
  const updates: Record<string, unknown> = {};
  if (input.name        !== undefined) updates['name']        = input.name;
  if (input.type        !== undefined) updates['type']        = input.type;
  if (input.description !== undefined) updates['description'] = input.description;
  if (input.items       !== undefined) updates['items']       = input.items;

  const doc = await ChecklistTemplate.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }) as IChecklistTemplateDocument | null;
  if (!doc) throw new AppError(404, 'Template not found');
  return templateToResponse(doc);
}

export async function deleteTemplate(id: string) {
  const doc = await ChecklistTemplate.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, 'Template not found');
}

// ── Run CRUD ──────────────────────────────────────────────────────────────────

export async function listRuns(query: { status?: string; type?: string }) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter['status'] = query.status;
  if (query.type)   filter['type']   = query.type;

  const docs = await ChecklistRun.find(filter)
    .populate('createdBy', 'displayName')
    .sort({ status: 1, createdAt: -1 }) as IChecklistRunDocument[];
  return docs.map(runToResponse);
}

export async function getRun(id: string) {
  const doc = await ChecklistRun.findById(id)
    .populate('createdBy', 'displayName') as IChecklistRunDocument | null;
  if (!doc) throw new AppError(404, 'Checklist run not found');
  return runToResponse(doc);
}

export async function createRun(input: CreateChecklistRunInput, userId: string) {
  const template = await ChecklistTemplate.findById(input.templateId) as IChecklistTemplateDocument | null;
  if (!template) throw new AppError(404, 'Template not found');

  const doc = await ChecklistRun.create({
    templateId:         new mongoose.Types.ObjectId(input.templateId),
    templateName:       template.name,
    type:               template.type,
    employeeName:       input.employeeName,
    employeeDepartment: input.employeeDepartment,
    assignedTo:         input.assignedTo,
    dueDate:            input.dueDate && input.dueDate !== '' ? new Date(input.dueDate) : undefined,
    notes:              input.notes,
    status:             'in_progress',
    items:              template.items.map((item) => ({
      title:       item.title,
      description: item.description,
      category:    item.category,
      required:    item.required,
      completed:   false,
    })),
    createdBy: new mongoose.Types.ObjectId(userId),
  }) as IChecklistRunDocument;
  return getRun(String(doc._id));
}

export async function updateRun(id: string, input: UpdateChecklistRunInput) {
  const updates: Record<string, unknown> = {};
  if (input.employeeName       !== undefined) updates['employeeName']       = input.employeeName;
  if (input.employeeDepartment !== undefined) updates['employeeDepartment'] = input.employeeDepartment;
  if (input.assignedTo         !== undefined) updates['assignedTo']         = input.assignedTo;
  if (input.dueDate            !== undefined) updates['dueDate']            = input.dueDate && input.dueDate !== '' ? new Date(input.dueDate) : null;
  if (input.notes              !== undefined) updates['notes']              = input.notes;
  if (input.status             !== undefined) {
    updates['status'] = input.status;
    if (input.status === 'completed') updates['completedAt'] = new Date();
    if (input.status === 'in_progress') updates['completedAt'] = null;
  }

  const doc = await ChecklistRun.findByIdAndUpdate(id, { $set: updates }, { new: true })
    .populate('createdBy', 'displayName') as IChecklistRunDocument | null;
  if (!doc) throw new AppError(404, 'Checklist run not found');
  return runToResponse(doc);
}

export async function deleteRun(id: string) {
  const doc = await ChecklistRun.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, 'Checklist run not found');
}

export async function toggleItem(runId: string, itemId: string, userId: string) {
  const actor = await User.findById(userId).select('displayName').lean();
  const completedBy = (actor as any)?.displayName ?? userId;
  const run = await ChecklistRun.findById(runId) as IChecklistRunDocument | null;
  if (!run) throw new AppError(404, 'Checklist run not found');

  const item = run.items.find((i) => i._id.toString() === itemId);
  if (!item) throw new AppError(404, 'Item not found');

  item.completed   = !item.completed;
  item.completedAt = item.completed ? new Date() : undefined;
  item.completedBy = item.completed ? completedBy : undefined;

  // Auto-complete the run when all required items are done
  const allRequired = run.items.filter((i) => i.required);
  const allDone     = allRequired.every((i) => i.completed);
  if (allDone && run.status === 'in_progress') {
    run.status      = 'completed';
    run.completedAt = new Date();
  } else if (!allDone && run.status === 'completed') {
    run.status      = 'in_progress';
    run.completedAt = undefined;
  }

  await run.save();
  await run.populate('createdBy', 'displayName');
  return runToResponse(run);
}

export async function updateItemNotes(runId: string, itemId: string, notes: string) {
  const run = await ChecklistRun.findById(runId) as IChecklistRunDocument | null;
  if (!run) throw new AppError(404, 'Checklist run not found');

  const item = run.items.find((i) => i._id.toString() === itemId);
  if (!item) throw new AppError(404, 'Item not found');

  item.notes = notes;
  await run.save();
  return runToResponse(run);
}
