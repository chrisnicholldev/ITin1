import mongoose from 'mongoose';
import { CannedResponse } from './canned-response.model.js';
import { AppError } from '../../middleware/error.middleware.js';

export async function listCannedResponses(categoryId?: string) {
  const filter: Record<string, unknown> = {};
  if (categoryId) {
    filter['$or'] = [
      { category: new mongoose.Types.ObjectId(categoryId) },
      { category: { $exists: false } },
      { category: null },
    ];
  }
  return CannedResponse.find(filter)
    .populate('category', 'name')
    .sort({ title: 1 })
    .lean();
}

export async function createCannedResponse(
  input: { title: string; body: string; categoryId?: string },
  createdBy: string,
) {
  const doc = await CannedResponse.create({
    title: input.title,
    body: input.body,
    ...(input.categoryId && { category: new mongoose.Types.ObjectId(input.categoryId) }),
    createdBy: new mongoose.Types.ObjectId(createdBy),
  });
  return doc;
}

export async function updateCannedResponse(
  id: string,
  input: { title?: string; body?: string; categoryId?: string | null },
) {
  const set: Record<string, unknown> = {};
  if (input.title !== undefined) set['title'] = input.title;
  if (input.body !== undefined) set['body'] = input.body;
  if (input.categoryId !== undefined) {
    set['category'] = input.categoryId ? new mongoose.Types.ObjectId(input.categoryId) : null;
  }
  const updated = await CannedResponse.findByIdAndUpdate(id, { $set: set }, { new: true });
  if (!updated) throw new AppError(404, 'Canned response not found');
  return updated;
}

export async function deleteCannedResponse(id: string) {
  const result = await CannedResponse.findByIdAndDelete(id);
  if (!result) throw new AppError(404, 'Canned response not found');
}
