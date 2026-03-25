import type { Request, Response } from 'express';
import * as service from './vault.service.js';
import { CreateCredentialSchema, UpdateCredentialSchema } from '@itdesk/shared';
import { AppError } from '../../middleware/error.middleware.js';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

function userId(req: Request): string {
  return (req as AuthenticatedRequest).user.id;
}

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  return req.socket.remoteAddress;
}

export async function listCredentials(req: Request, res: Response) {
  const assetId = req.query['assetId'] as string | undefined;
  const { id, role } = (req as AuthenticatedRequest).user;
  const data = await service.listCredentials(id, role, assetId);
  res.json(data);
}

export async function getCredential(req: Request, res: Response) {
  const data = await service.getCredential(String(req.params['id']));
  res.json(data);
}

export async function revealPassword(req: Request, res: Response) {
  const { id, role } = (req as AuthenticatedRequest).user;
  const data = await service.revealPassword(String(req.params['id']), id, role, clientIp(req));
  res.json(data);
}

export async function copyPassword(req: Request, res: Response) {
  const { id, role } = (req as AuthenticatedRequest).user;
  const data = await service.copyPassword(String(req.params['id']), id, role, clientIp(req));
  res.json(data);
}

export async function createCredential(req: Request, res: Response) {
  const parsed = CreateCredentialSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Validation error: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
  }
  const data = await service.createCredential(parsed.data, userId(req));
  res.status(201).json(data);
}

export async function updateCredential(req: Request, res: Response) {
  const parsed = UpdateCredentialSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Validation error: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
  }
  const data = await service.updateCredential(String(req.params['id']), parsed.data, userId(req));
  res.json(data);
}

export async function deleteCredential(req: Request, res: Response) {
  await service.deleteCredential(String(req.params['id']), userId(req));
  res.status(204).end();
}

export async function bulkDeleteCredentials(req: Request, res: Response) {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) throw new AppError(400, 'Expected non-empty ids array');
  const result = await service.bulkDeleteCredentials(ids, userId(req));
  res.json(result);
}

export async function importCredentials(req: Request, res: Response) {
  if (!Array.isArray(req.body)) throw new AppError(400, 'Expected an array');
  const result = await service.importCredentials(req.body, userId(req));
  res.json(result);
}

export async function getAuditLog(req: Request, res: Response) {
  const credentialId = req.query['credentialId'] as string | undefined;
  const data = await service.getAuditLog(credentialId);
  res.json(data);
}
