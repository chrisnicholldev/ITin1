import type { Request, Response } from 'express';
import * as categoryService from './category.service.js';
import { CreateCategorySchema, UpdateCategorySchema } from '@itdesk/shared';

export async function listCategories(req: Request, res: Response): Promise<void> {
  const activeOnly = req.query['activeOnly'] !== 'false';
  res.json(await categoryService.listCategories(activeOnly));
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  const input = CreateCategorySchema.parse(req.body);
  res.status(201).json(await categoryService.createCategory(input));
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  const input = UpdateCategorySchema.parse(req.body);
  res.json(await categoryService.updateCategory(String(req.params['id']), input));
}

export async function deleteCategory(req: Request, res: Response): Promise<void> {
  await categoryService.deleteCategory(String(req.params['id']));
  res.status(204).send();
}
