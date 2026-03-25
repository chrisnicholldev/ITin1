import mongoose, { type Document, type Model } from 'mongoose';
import { CredentialCategory, VaultAccessLevel, VaultAuditAction } from '@itdesk/shared';

// ── Credential ────────────────────────────────────────────────────────────────

export interface ICredential {
  title: string;
  username?: string;
  // Encrypted fields stored as hex strings
  encryptedPassword: string;
  passwordIv: string;
  passwordAuthTag: string;
  url?: string;
  notes?: string;
  category: string;
  linkedAsset?: mongoose.Types.ObjectId;
  tags: string[];
  accessLevel: string;
  allowedUsers: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICredentialDocument extends ICredential, Document {}

const credentialSchema = new mongoose.Schema<ICredentialDocument>(
  {
    title: { type: String, required: true, trim: true },
    username: String,
    encryptedPassword: { type: String, required: true },
    passwordIv: { type: String, required: true },
    passwordAuthTag: { type: String, required: true },
    url: String,
    notes: String,
    category: {
      type: String,
      required: true,
      enum: Object.values(CredentialCategory),
      default: CredentialCategory.OTHER,
    },
    linkedAsset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
    tags: [{ type: String }],
    accessLevel: {
      type: String,
      enum: Object.values(VaultAccessLevel),
      default: VaultAccessLevel.STAFF,
      required: true,
    },
    allowedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

credentialSchema.index({ category: 1 });
credentialSchema.index({ linkedAsset: 1 });
credentialSchema.index({ tags: 1 });

export const Credential: Model<ICredentialDocument> = mongoose.model<ICredentialDocument>(
  'Credential',
  credentialSchema,
);

// ── Vault Audit Log ───────────────────────────────────────────────────────────

export interface IVaultAudit {
  credential: mongoose.Types.ObjectId;
  credentialTitle: string; // snapshot in case credential is deleted
  user: mongoose.Types.ObjectId;
  action: string;
  ip?: string;
  createdAt: Date;
}

export interface IVaultAuditDocument extends IVaultAudit, Document {}

const vaultAuditSchema = new mongoose.Schema<IVaultAuditDocument>(
  {
    credential: { type: mongoose.Schema.Types.ObjectId, ref: 'Credential', required: true },
    credentialTitle: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, enum: Object.values(VaultAuditAction) },
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

vaultAuditSchema.index({ credential: 1, createdAt: -1 });
vaultAuditSchema.index({ user: 1, createdAt: -1 });
vaultAuditSchema.index({ createdAt: -1 });

export const VaultAudit: Model<IVaultAuditDocument> = mongoose.model<IVaultAuditDocument>(
  'VaultAudit',
  vaultAuditSchema,
);
