import type { Request, Response } from 'express';
import { listContacts, createManualContact, updateManualContact, deleteManualContact } from './contact.service.js';

export async function getContacts(req: Request, res: Response) {
  const search = typeof req.query['search'] === 'string' ? req.query['search'] : undefined;
  const contacts = await listContacts(search, 100);
  res.json({ data: contacts });
}

export async function createContact(req: Request, res: Response) {
  const { displayName, email, phone, company, jobTitle, department, notes } =
    req.body as Record<string, string>;
  if (!displayName?.trim()) {
    res.status(400).json({ error: 'displayName is required' });
    return;
  }
  const contact = await createManualContact({ displayName: displayName.trim(), email, phone, company, jobTitle, department, notes });
  res.status(201).json(contact);
}

export async function updateContact(req: Request, res: Response) {
  const contact = await updateManualContact(String(req.params['id']), req.body as Record<string, string>);
  res.json(contact);
}

export async function deleteContact(req: Request, res: Response) {
  await deleteManualContact(String(req.params['id']));
  res.status(204).send();
}
