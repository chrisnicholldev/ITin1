import type { Request, Response } from 'express';
import { CreateVendorSchema, UpdateVendorSchema, VendorContactSchema } from '@itdesk/shared';
import * as service from './vendor.service.js';

export async function listVendors(req: Request, res: Response) {
  res.json(await service.listVendors());
}

export async function getVendor(req: Request, res: Response) {
  res.json(await service.getVendor(String(req.params['id'])));
}

export async function createVendor(req: Request, res: Response) {
  const input = CreateVendorSchema.parse(req.body);
  res.status(201).json(await service.createVendor(input));
}

export async function updateVendor(req: Request, res: Response) {
  const input = UpdateVendorSchema.parse(req.body);
  res.json(await service.updateVendor(String(req.params['id']), input));
}

export async function deleteVendor(req: Request, res: Response) {
  await service.deleteVendor(String(req.params['id']));
  res.status(204).end();
}

export async function addContact(req: Request, res: Response) {
  const input = VendorContactSchema.parse(req.body);
  res.status(201).json(await service.addContact(String(req.params['id']), input));
}

export async function updateContact(req: Request, res: Response) {
  const input = VendorContactSchema.partial().parse(req.body);
  res.json(await service.updateContact(String(req.params['id']), String(req.params['contactId']), input));
}

export async function deleteContact(req: Request, res: Response) {
  res.json(await service.deleteContact(String(req.params['id']), String(req.params['contactId'])));
}
