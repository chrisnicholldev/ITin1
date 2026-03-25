import type { Request, Response } from 'express';
import * as service from './location.service.js';
import { CreateLocationSchema, UpdateLocationSchema } from '@itdesk/shared';
import { AppError } from '../../middleware/error.middleware.js';

export async function listLocations(_req: Request, res: Response) {
  res.json(await service.listLocations());
}

export async function createLocation(req: Request, res: Response) {
  const parsed = CreateLocationSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Validation error: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
  res.status(201).json(await service.createLocation(parsed.data));
}

export async function updateLocation(req: Request, res: Response) {
  const parsed = UpdateLocationSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Validation error: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
  res.json(await service.updateLocation(String(req.params['id']), parsed.data));
}

export async function deleteLocation(req: Request, res: Response) {
  await service.deleteLocation(String(req.params['id']));
  res.status(204).end();
}
