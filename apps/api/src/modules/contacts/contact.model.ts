import mongoose, { type Document, type Model } from 'mongoose';

export const CONTACT_SOURCE = {
  AZURE_AD: 'azure_ad',
  MANUAL: 'manual',
} as const;

export interface IContact {
  source: string;
  displayName: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  department?: string;
  notes?: string;
  // Azure AD only
  azureId?: string;
  upn?: string;
  accountEnabled?: boolean;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IContactDocument extends IContact, Document {}

const contactSchema = new mongoose.Schema<IContactDocument>(
  {
    source: { type: String, enum: Object.values(CONTACT_SOURCE), default: CONTACT_SOURCE.AZURE_AD, required: true },
    displayName: { type: String, required: true },
    email: String,
    phone: String,
    company: String,
    jobTitle: String,
    department: String,
    notes: String,
    azureId: { type: String, sparse: true, unique: true },
    upn: { type: String, sparse: true },
    accountEnabled: { type: Boolean },
    lastSyncedAt: { type: Date },
  },
  { timestamps: true },
);

contactSchema.index({ email: 1 });
contactSchema.index({ source: 1 });
contactSchema.index({ displayName: 'text', email: 'text', upn: 'text', company: 'text' });

export const Contact: Model<IContactDocument> = mongoose.model<IContactDocument>('Contact', contactSchema);
