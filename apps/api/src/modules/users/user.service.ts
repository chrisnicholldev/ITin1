import { User, type IUserDocument } from './user.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type { CreateUserInput, UpdateUserInput } from '@itdesk/shared';
import bcrypt from 'bcryptjs';
import { AuthProvider } from '@itdesk/shared';

function toResponse(user: IUserDocument) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    username: user.username,
    role: user.role,
    authProvider: user.authProvider,
    department: user.department,
    title: user.title,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    lastLogin: user.lastLogin,
    notificationPreferences: user.notificationPreferences ?? {
      onTicketCreated: true,
      onTicketAssigned: true,
      onStatusChanged: true,
      onCommentAdded: true,
    },
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export type ListUsersQuery = { sort: string; page: number; limit: number; order: 'asc' | 'desc'; role?: string; department?: string; search?: string };

export async function listUsers(query: ListUsersQuery) {
  const filter: Record<string, unknown> = {};
  if (query.role) filter['role'] = query.role;
  if (query.department) filter['department'] = query.department;
  if (query.search) {
    filter['$or'] = [
      { displayName: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
      { username: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    User.find(filter)
      .sort({ [query.sort]: query.order === 'asc' ? 1 : -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit) as Promise<IUserDocument[]>,
    User.countDocuments(filter),
  ]);

  return {
    data: data.map(toResponse),
    meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getUser(id: string) {
  const user = await User.findById(id) as IUserDocument | null;
  if (!user) throw new AppError(404, 'User not found');
  return toResponse(user);
}

export async function createUser(input: CreateUserInput) {
  const existing = await User.findOne({ $or: [{ email: input.email }, { username: input.username }] });
  if (existing) throw new AppError(409, 'User with that email or username already exists');

  const doc: Record<string, unknown> = { ...input, authProvider: AuthProvider.LOCAL };
  if (input.password) {
    doc['passwordHash'] = await bcrypt.hash(input.password, 12);
  }
  delete doc['password'];

  const user = await User.create(doc) as IUserDocument;
  return toResponse(user);
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const user = await User.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }) as IUserDocument | null;
  if (!user) throw new AppError(404, 'User not found');
  return toResponse(user);
}

export async function deactivateUser(id: string) {
  const user = await User.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true }) as IUserDocument | null;
  if (!user) throw new AppError(404, 'User not found');
  return toResponse(user);
}

export async function reactivateUser(id: string) {
  const user = await User.findByIdAndUpdate(id, { $set: { isActive: true } }, { new: true }) as IUserDocument | null;
  if (!user) throw new AppError(404, 'User not found');
  return toResponse(user);
}

export async function resetPassword(id: string, newPassword: string) {
  const user = await User.findById(id) as IUserDocument | null;
  if (!user) throw new AppError(404, 'User not found');
  if (user.authProvider !== AuthProvider.LOCAL) {
    throw new AppError(400, 'Cannot reset password for LDAP users');
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await User.findByIdAndUpdate(id, { $set: { passwordHash } });
}

export async function updateSelf(
  id: string,
  input: { displayName?: string; phone?: string; email?: string },
  authProvider: string,
) {
  const update: Record<string, unknown> = {};
  if (input.displayName?.trim()) update['displayName'] = input.displayName.trim();
  if (input.phone !== undefined) update['phone'] = input.phone.trim() || undefined;
  // Only LOCAL users can change their own email — LDAP/Azure email is managed by the IdP
  if (input.email?.trim() && authProvider === AuthProvider.LOCAL) {
    const existing = await User.findOne({ email: input.email.toLowerCase(), _id: { $ne: id } });
    if (existing) throw new AppError(409, 'Email already in use');
    update['email'] = input.email.toLowerCase().trim();
  }

  const user = await User.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }) as IUserDocument | null;
  if (!user) throw new AppError(404, 'User not found');
  return toResponse(user);
}

export async function updateNotificationPreferences(
  id: string,
  prefs: Partial<{ onTicketCreated: boolean; onTicketAssigned: boolean; onStatusChanged: boolean; onCommentAdded: boolean }>,
) {
  const update: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(prefs)) {
    if (v !== undefined) update[`notificationPreferences.${k}`] = v;
  }
  const updated = await User.findByIdAndUpdate(id, { $set: update }, { new: true }) as IUserDocument | null;
  if (!updated) throw new AppError(404, 'User not found');
  return toResponse(updated);
}
