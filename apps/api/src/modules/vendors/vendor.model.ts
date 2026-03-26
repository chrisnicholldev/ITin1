import mongoose, { type Document, type Model } from 'mongoose';
import { VendorType } from '@itdesk/shared';

export interface IVendorContact {
  _id: mongoose.Types.ObjectId;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  notes?: string;
  isPrimary: boolean;
}

export interface IVendor {
  name: string;
  type: string;
  website?: string;
  supportPhone?: string;
  supportEmail?: string;
  accountNumber?: string;
  notes?: string;
  contacts: IVendorContact[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IVendorDocument extends IVendor, Document {}

const vendorContactSchema = new mongoose.Schema<IVendorContact>({
  name: { type: String, required: true, trim: true },
  title: String,
  phone: String,
  email: String,
  notes: String,
  isPrimary: { type: Boolean, default: false },
});

const vendorSchema = new mongoose.Schema<IVendorDocument>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: Object.values(VendorType) },
    website: String,
    supportPhone: String,
    supportEmail: String,
    accountNumber: String,
    notes: String,
    contacts: [vendorContactSchema],
  },
  { timestamps: true },
);

vendorSchema.index({ name: 1 });
vendorSchema.index({ type: 1 });

export const Vendor: Model<IVendorDocument> = mongoose.model<IVendorDocument>('Vendor', vendorSchema);
