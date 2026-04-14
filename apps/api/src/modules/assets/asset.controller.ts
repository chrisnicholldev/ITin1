import type { Request, Response } from 'express';
import * as assetService from './asset.service.js';
import { CreateAssetSchema, UpdateAssetSchema } from '@itdesk/shared';

export async function listAssets(req: Request, res: Response): Promise<void> {
  res.json(await assetService.listAssets(req.query));
}

export async function getAsset(req: Request, res: Response): Promise<void> {
  res.json(await assetService.getAsset(String(req.params['id'])));
}

export async function createAsset(req: Request, res: Response): Promise<void> {
  const input = CreateAssetSchema.parse(req.body);
  res.status(201).json(await assetService.createAsset(input));
}

export async function updateAsset(req: Request, res: Response): Promise<void> {
  const input = UpdateAssetSchema.parse(req.body);
  res.json(await assetService.updateAsset(String(req.params['id']), input));
}

export async function deactivateAsset(req: Request, res: Response): Promise<void> {
  await assetService.deactivateAsset(String(req.params['id']));
  res.status(204).send();
}

export async function getSummary(_req: Request, res: Response): Promise<void> {
  res.json(await assetService.getSummary());
}

export async function importAssets(req: Request, res: Response): Promise<void> {
  const result = await assetService.importAssets(req.body);
  res.json(result);
}
