import type { Request, Response } from 'express';
import * as service from './rack.service.js';
import { CreateRackSchema, UpdateRackSchema, CreateRackMountSchema } from '@itdesk/shared';
import { AppError } from '../../middleware/error.middleware.js';

export async function listRacks(_req: Request, res: Response) {
  res.json(await service.listRacks());
}

export async function getRack(req: Request, res: Response) {
  res.json(await service.getRack(String(req.params['id'])));
}

export async function createRack(req: Request, res: Response) {
  const parsed = CreateRackSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Validation error: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
  res.status(201).json(await service.createRack(parsed.data));
}

export async function updateRack(req: Request, res: Response) {
  const parsed = UpdateRackSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Validation error: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
  res.json(await service.updateRack(String(req.params['id']), parsed.data));
}

export async function deleteRack(req: Request, res: Response) {
  await service.deleteRack(String(req.params['id']));
  res.status(204).end();
}

export async function addMount(req: Request, res: Response) {
  const parsed = CreateRackMountSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Validation error: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
  res.status(201).json(await service.addMount(String(req.params['id']), parsed.data));
}

export async function updateMount(req: Request, res: Response) {
  res.json(await service.updateMount(String(req.params['id']), String(req.params['mountId']), req.body));
}

export async function removeMount(req: Request, res: Response) {
  await service.removeMount(String(req.params['id']), String(req.params['mountId']));
  res.status(204).end();
}
