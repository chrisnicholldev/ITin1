import mongoose from 'mongoose';
import { Credential, VaultAudit, type ICredentialDocument } from './vault.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { VaultAccessLevel, VaultAuditAction, UserRole } from '@itdesk/shared';
import type { CreateCredentialInput, UpdateCredentialInput } from '@itdesk/shared';

function toResponse(doc: ICredentialDocument) {
  const obj = doc.toObject({ virtuals: true });
  return {
    id: doc.id as string,
    title: doc.title,
    username: doc.username,
    url: doc.url,
    notes: doc.notes,
    category: doc.category,
    linkedAsset: obj.linkedAsset
      ? { id: obj.linkedAsset._id?.toString() ?? obj.linkedAsset.id, name: obj.linkedAsset.name, assetTag: obj.linkedAsset.assetTag }
      : undefined,
    tags: doc.tags,
    accessLevel: doc.accessLevel ?? VaultAccessLevel.STAFF,
    allowedUsers: (obj.allowedUsers ?? []).map((u: any) => ({
      id: u._id?.toString() ?? u.id ?? String(u),
      displayName: u.displayName ?? '',
      email: u.email ?? '',
    })),
    createdBy: obj.createdBy
      ? { id: obj.createdBy._id?.toString() ?? obj.createdBy.id, displayName: obj.createdBy.displayName }
      : undefined,
    updatedBy: obj.updatedBy
      ? { id: obj.updatedBy._id?.toString() ?? obj.updatedBy.id, displayName: obj.updatedBy.displayName }
      : undefined,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function canAccess(doc: ICredentialDocument, userId: string, userRole: string): boolean {
  const isAdmin = userRole === UserRole.IT_ADMIN || userRole === UserRole.SUPER_ADMIN;
  if (doc.accessLevel === VaultAccessLevel.ADMIN) return isAdmin;
  if (doc.accessLevel === VaultAccessLevel.RESTRICTED) {
    return isAdmin || (doc.allowedUsers ?? []).some((id) => id.toString() === userId);
  }
  return true; // staff
}

async function logAudit(
  credentialId: mongoose.Types.ObjectId,
  credentialTitle: string,
  userId: string,
  action: string,
  ip?: string,
) {
  await VaultAudit.create({
    credential: credentialId,
    credentialTitle,
    user: new mongoose.Types.ObjectId(userId),
    action,
    ip,
  });
}

export async function listCredentials(userId: string, userRole: string, assetId?: string) {
  const filter = assetId ? { linkedAsset: new mongoose.Types.ObjectId(assetId) } : {};
  const docs = await Credential.find(filter)
    .populate('linkedAsset', 'name assetTag')
    .populate('createdBy', 'displayName')
    .populate('updatedBy', 'displayName')
    .populate('allowedUsers', 'displayName email')
    .sort({ category: 1, title: 1 }) as ICredentialDocument[];
  return docs.filter((d) => canAccess(d, userId, userRole)).map(toResponse);
}

export async function getCredential(id: string) {
  const doc = await Credential.findById(id)
    .populate('linkedAsset', 'name assetTag')
    .populate('createdBy', 'displayName')
    .populate('updatedBy', 'displayName') as ICredentialDocument | null;
  if (!doc) throw new AppError(404, 'Credential not found');
  return toResponse(doc);
}

export async function revealPassword(id: string, userId: string, userRole: string, ip?: string) {
  const doc = await Credential.findById(id) as ICredentialDocument | null;
  if (!doc) throw new AppError(404, 'Credential not found');
  if (!canAccess(doc, userId, userRole)) throw new AppError(403, 'Access denied');
  const plaintext = decrypt(doc.passwordIv, doc.encryptedPassword, doc.passwordAuthTag);
  await logAudit(doc._id as mongoose.Types.ObjectId, doc.title, userId, VaultAuditAction.VIEW, ip);
  return { password: plaintext };
}

export async function copyPassword(id: string, userId: string, userRole: string, ip?: string) {
  const doc = await Credential.findById(id) as ICredentialDocument | null;
  if (!doc) throw new AppError(404, 'Credential not found');
  if (!canAccess(doc, userId, userRole)) throw new AppError(403, 'Access denied');
  const plaintext = decrypt(doc.passwordIv, doc.encryptedPassword, doc.passwordAuthTag);
  await logAudit(doc._id as mongoose.Types.ObjectId, doc.title, userId, VaultAuditAction.COPY, ip);
  return { password: plaintext };
}

export async function createCredential(input: CreateCredentialInput, userId: string) {
  const { iv, ciphertext, authTag } = encrypt(input.password);
  const doc = await Credential.create({
    title: input.title,
    username: input.username,
    encryptedPassword: ciphertext,
    passwordIv: iv,
    passwordAuthTag: authTag,
    url: input.url,
    notes: input.notes,
    category: input.category,
    linkedAsset: input.linkedAsset ? new mongoose.Types.ObjectId(input.linkedAsset) : undefined,
    tags: input.tags ?? [],
    accessLevel: input.accessLevel ?? VaultAccessLevel.STAFF,
    allowedUsers: (input.allowedUsers ?? []).map((id) => new mongoose.Types.ObjectId(id)),
    createdBy: new mongoose.Types.ObjectId(userId),
  }) as ICredentialDocument;

  await logAudit(doc._id as mongoose.Types.ObjectId, doc.title, userId, VaultAuditAction.CREATE);
  return getCredential(doc.id as string);
}

export async function updateCredential(id: string, input: UpdateCredentialInput, userId: string) {
  const doc = await Credential.findById(id) as ICredentialDocument | null;
  if (!doc) throw new AppError(404, 'Credential not found');

  const updates: Record<string, unknown> = {
    updatedBy: new mongoose.Types.ObjectId(userId),
  };

  if (input.title !== undefined) updates['title'] = input.title;
  if (input.username !== undefined) updates['username'] = input.username;
  if (input.url !== undefined) updates['url'] = input.url;
  if (input.notes !== undefined) updates['notes'] = input.notes;
  if (input.category !== undefined) updates['category'] = input.category;
  if (input.tags !== undefined) updates['tags'] = input.tags;
  if (input.linkedAsset !== undefined) {
    updates['linkedAsset'] = input.linkedAsset ? new mongoose.Types.ObjectId(input.linkedAsset) : null;
  }
  if (input.accessLevel !== undefined) updates['accessLevel'] = input.accessLevel;
  if (input.allowedUsers !== undefined) {
    updates['allowedUsers'] = input.allowedUsers.map((id) => new mongoose.Types.ObjectId(id));
  }
  if (input.password !== undefined) {
    const { iv, ciphertext, authTag } = encrypt(input.password);
    updates['encryptedPassword'] = ciphertext;
    updates['passwordIv'] = iv;
    updates['passwordAuthTag'] = authTag;
  }

  await Credential.findByIdAndUpdate(id, { $set: updates });
  await logAudit(doc._id as mongoose.Types.ObjectId, doc.title, userId, VaultAuditAction.UPDATE);
  return getCredential(id);
}

export async function deleteCredential(id: string, userId: string) {
  const doc = await Credential.findById(id) as ICredentialDocument | null;
  if (!doc) throw new AppError(404, 'Credential not found');
  await logAudit(doc._id as mongoose.Types.ObjectId, doc.title, userId, VaultAuditAction.DELETE);
  await Credential.findByIdAndDelete(id);
}

export async function bulkDeleteCredentials(ids: string[], userId: string) {
  const docs = await Credential.find({ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } }) as ICredentialDocument[];
  await Promise.all(docs.map((doc) =>
    logAudit(doc._id as mongoose.Types.ObjectId, doc.title, userId, VaultAuditAction.DELETE),
  ));
  await Credential.deleteMany({ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } });
  return { deleted: docs.length };
}

export async function importCredentials(
  items: Array<{ title: string; username?: string; password: string; url?: string; notes?: string; category?: string; accessLevel?: string }>,
  userId: string,
) {
  let imported = 0;
  let skipped = 0;
  for (const item of items) {
    if (!item.title?.trim() || !item.password?.trim()) { skipped++; continue; }
    const { iv, ciphertext, authTag } = encrypt(item.password);
    const doc = await Credential.create({
      title: item.title.slice(0, 200),
      username: item.username?.slice(0, 200) || undefined,
      encryptedPassword: ciphertext,
      passwordIv: iv,
      passwordAuthTag: authTag,
      url: item.url?.slice(0, 500) || undefined,
      notes: item.notes?.slice(0, 2000) || undefined,
      category: item.category ?? 'other',
      accessLevel: item.accessLevel ?? VaultAccessLevel.STAFF,
      tags: [],
      createdBy: new mongoose.Types.ObjectId(userId),
    }) as ICredentialDocument;
    await logAudit(doc._id as mongoose.Types.ObjectId, doc.title, userId, VaultAuditAction.CREATE);
    imported++;
  }
  return { imported, skipped };
}

export async function getAuditLog(credentialId?: string) {
  const filter = credentialId ? { credential: new mongoose.Types.ObjectId(credentialId) } : {};
  const logs = await VaultAudit.find(filter)
    .populate('user', 'displayName')
    .sort({ createdAt: -1 })
    .limit(500);

  return logs.map((l) => {
    const obj = l.toObject({ virtuals: true }) as Record<string, any>;
    return {
      id: l.id as string,
      credential: { id: String(obj['credential']), title: l.credentialTitle },
      user: { id: String(obj['user']?._id ?? obj['user']), displayName: obj['user']?.displayName ?? '' },
      action: l.action,
      ip: l.ip,
      createdAt: l.createdAt.toISOString(),
    };
  });
}
