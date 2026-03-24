import type { Request, Response } from 'express';
import * as userService from './user.service.js';
import type { ListUsersQuery } from './user.service.js';
import { PaginationQuerySchema, CreateUserSchema, UpdateUserSchema } from '@itdesk/shared';
import { z } from 'zod';

const ListQuerySchema = PaginationQuerySchema.extend({
  role: z.string().optional(),
  department: z.string().optional(),
  search: z.string().optional(),
});

export async function listUsers(req: Request, res: Response): Promise<void> {
  const query = ListQuerySchema.parse(req.query);
  res.json(await userService.listUsers(query as ListUsersQuery));
}

export async function getUser(req: Request, res: Response): Promise<void> {
  res.json(await userService.getUser(String(req.params['id'])));
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const input = CreateUserSchema.parse(req.body);
  res.status(201).json(await userService.createUser(input));
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const input = UpdateUserSchema.parse(req.body);
  res.json(await userService.updateUser(String(req.params['id']), input));
}

export async function deactivateUser(req: Request, res: Response): Promise<void> {
  await userService.deactivateUser(String(req.params['id']));
  res.status(204).send();
}
