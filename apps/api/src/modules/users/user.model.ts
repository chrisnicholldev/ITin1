import mongoose, { type Document, type Model } from 'mongoose';
import { UserRole, AuthProvider } from '@itdesk/shared';

export interface IUser {
  email: string;
  displayName: string;
  username: string;
  passwordHash?: string;
  authProvider: string;
  role: string;
  department?: string;
  title?: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  lastLogin?: Date;
  ldapDn?: string;
  azureId?: string;
  refreshTokenHash?: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  twoFactorPendingSecret?: string;
  twoFactorRecoveryCodes?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {}

const userSchema = new mongoose.Schema<IUserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    authProvider: {
      type: String,
      enum: Object.values(AuthProvider),
      default: AuthProvider.LOCAL,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.END_USER,
    },
    department: String,
    title: String,
    phone: String,
    avatarUrl: String,
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
    ldapDn: String,
    azureId: { type: String, sparse: true },
    refreshTokenHash: { type: String, select: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    twoFactorPendingSecret: { type: String, select: false },
    twoFactorRecoveryCodes: { type: [String], select: false },
  },
  { timestamps: true },
);

userSchema.index({ role: 1 });
userSchema.index({ department: 1 });
userSchema.index({ isActive: 1 });

export const User: Model<IUserDocument> = mongoose.model<IUserDocument>('User', userSchema);
