import mongoose, { type Document, type Model } from 'mongoose';

export interface IContact {
  azureId: string;
  displayName: string;
  email?: string;
  upn: string;
  department?: string;
  jobTitle?: string;
  accountEnabled: boolean;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IContactDocument extends IContact, Document {}

const contactSchema = new mongoose.Schema<IContactDocument>(
  {
    azureId: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    email: String,
    upn: { type: String, required: true },
    department: String,
    jobTitle: String,
    accountEnabled: { type: Boolean, default: true },
    lastSyncedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

contactSchema.index({ upn: 1 });
contactSchema.index({ email: 1 });
contactSchema.index({ displayName: 'text', email: 'text', upn: 'text' });

export const Contact: Model<IContactDocument> = mongoose.model<IContactDocument>('Contact', contactSchema);
