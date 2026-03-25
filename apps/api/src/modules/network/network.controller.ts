import type { Request, Response, NextFunction } from 'express';
import { CreateNetworkSchema, UpdateNetworkSchema } from '@itdesk/shared';
import * as svc from './network.service.js';

export async function listNetworks(req: Request, res: Response, next: NextFunction) {
  try {
    const locationId = req.query['locationId'] as string | undefined;
    res.json(await svc.listNetworks(locationId));
  } catch (e) { next(e); }
}

export async function getNetwork(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.getNetwork(String(req.params['id'])));
  } catch (e) { next(e); }
}

export async function createNetwork(req: Request, res: Response, next: NextFunction) {
  try {
    const input = CreateNetworkSchema.parse(req.body);
    res.status(201).json(await svc.createNetwork(input));
  } catch (e) { next(e); }
}

export async function updateNetwork(req: Request, res: Response, next: NextFunction) {
  try {
    const input = UpdateNetworkSchema.parse(req.body);
    res.json(await svc.updateNetwork(String(req.params['id']), input));
  } catch (e) { next(e); }
}

export async function deleteNetwork(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteNetwork(String(req.params['id']));
    res.status(204).end();
  } catch (e) { next(e); }
}
