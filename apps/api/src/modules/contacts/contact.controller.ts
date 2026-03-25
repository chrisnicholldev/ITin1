import type { Request, Response } from 'express';
import { searchContacts } from './contact.service.js';

export async function listContacts(req: Request, res: Response) {
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const contacts = await searchContacts(search, 30);
  res.json({ data: contacts });
}
