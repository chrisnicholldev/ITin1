import mongoose, { Schema, type Document } from 'mongoose';

export interface ISecureShare extends Document {
  token: string;
  encryptedContent: string;
  contentIv: string;
  contentAuthTag: string;
  contentType: 'credential' | 'note';
  credentialId?: mongoose.Types.ObjectId;
  credentialTitle?: string;
  recipientEmail: string;
  createdBy: mongoose.Types.ObjectId;
  expiresAt: Date;
  viewLimit: number;
  viewCount: number;
  destroyed: boolean;
}

const SecureShareSchema = new Schema<ISecureShare>(
  {
    token:            { type: String, required: true, unique: true, index: true },
    encryptedContent: { type: String, required: true },
    contentIv:        { type: String, required: true },
    contentAuthTag:   { type: String, required: true },
    contentType:      { type: String, enum: ['credential', 'note'], required: true },
    credentialId:     { type: Schema.Types.ObjectId, ref: 'Credential' },
    credentialTitle:  { type: String },
    recipientEmail:   { type: String, required: true },
    createdBy:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt:        { type: Date, required: true },
    viewLimit:        { type: Number, default: 1 },
    viewCount:        { type: Number, default: 0 },
    destroyed:        { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Auto-delete expired shares after 7 days grace period
SecureShareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

export const SecureShare = mongoose.model<ISecureShare>('SecureShare', SecureShareSchema);
