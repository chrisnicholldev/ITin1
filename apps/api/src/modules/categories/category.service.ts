import mongoose from 'mongoose';
import { Category, type ICategoryDocument } from './category.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type { CreateCategoryInput, UpdateCategoryInput } from '@itdesk/shared';

function toResponse(cat: ICategoryDocument) {
  return {
    id: cat.id,
    name: cat.name,
    description: cat.description,
    defaultPriority: cat.defaultPriority,
    defaultAssignee: cat.defaultAssignee,
    subcategories: cat.subcategories,
    isActive: cat.isActive,
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt,
  };
}

export async function listCategories(activeOnly = true) {
  const filter = activeOnly ? { isActive: true } : {};
  const cats = await Category.find(filter)
    .populate('defaultAssignee', 'displayName')
    .sort({ name: 1 }) as ICategoryDocument[];
  return cats.map(toResponse);
}

export async function createCategory(input: CreateCategoryInput) {
  const existing = await Category.findOne({ name: input.name });
  if (existing) throw new AppError(409, 'Category with that name already exists');

  const doc: Record<string, unknown> = {
    ...input,
    defaultAssignee: input.defaultAssignee
      ? new mongoose.Types.ObjectId(input.defaultAssignee)
      : undefined,
  };
  const cat = await Category.create(doc) as ICategoryDocument;
  return toResponse(cat);
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  const updates: Record<string, unknown> = { ...input };
  if (input.defaultAssignee !== undefined) {
    updates['defaultAssignee'] = input.defaultAssignee
      ? new mongoose.Types.ObjectId(input.defaultAssignee)
      : null;
  }

  const cat = await Category.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true })
    .populate('defaultAssignee', 'displayName') as ICategoryDocument | null;

  if (!cat) throw new AppError(404, 'Category not found');
  return toResponse(cat);
}

export async function deleteCategory(id: string) {
  const cat = await Category.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true }) as ICategoryDocument | null;
  if (!cat) throw new AppError(404, 'Category not found');
}

const DEFAULT_CATEGORIES = [
  { name: 'Hardware', description: 'Physical hardware issues, failures, or requests', defaultPriority: 'medium' },
  { name: 'Software', description: 'Application errors, installations, or licence requests', defaultPriority: 'medium' },
  { name: 'Network', description: 'Connectivity, Wi-Fi, VPN, or network access issues', defaultPriority: 'high' },
  { name: 'Account / Access', description: 'Password resets, account lockouts, permissions', defaultPriority: 'high' },
  { name: 'Email', description: 'Email client issues, delivery problems, spam', defaultPriority: 'medium' },
  { name: 'General Request', description: 'General IT requests and enquiries', defaultPriority: 'low' },
];

export async function bootstrapCategories(): Promise<void> {
  const count = await Category.countDocuments();
  if (count > 0) return;

  console.log('[categories] No categories found — seeding defaults');
  await Category.insertMany(DEFAULT_CATEGORIES);
  console.log(`[categories] Seeded ${DEFAULT_CATEGORIES.length} default categories`);
}
