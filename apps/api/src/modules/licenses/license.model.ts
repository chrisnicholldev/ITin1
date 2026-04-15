import mongoose, { type Document, type Model } from 'mongoose';

export interface ILicense {
  name: string;
  vendor?: string;
  licenseType: 'subscription' | 'perpetual' | 'oem' | 'volume' | 'freeware' | 'open_source';
  seats?: number;
  cost?: number;
  billingCycle?: 'monthly' | 'annually' | 'one_time';
  purchasedAt?: Date;
  renewalDate?: Date;
  licenseKey?: string;
  assignedTo?: string;
  notes?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ILicenseDocument extends ILicense, Document {}

const licenseSchema = new mongoose.Schema<ILicenseDocument>(
  {
    name:         { type: String, required: true, trim: true },
    vendor:       { type: String, trim: true },
    licenseType:  { type: String, enum: ['subscription', 'perpetual', 'oem', 'volume', 'freeware', 'open_source'], default: 'subscription' },
    seats:        { type: Number },
    cost:         { type: Number },
    billingCycle: { type: String, enum: ['monthly', 'annually', 'one_time'] },
    purchasedAt:  { type: Date },
    renewalDate:  { type: Date },
    licenseKey:   { type: String },
    assignedTo:   { type: String, trim: true },
    notes:        { type: String },
    tags:         [{ type: String }],
  },
  { timestamps: true },
);

licenseSchema.index({ name: 1 });
licenseSchema.index({ renewalDate: 1 });
licenseSchema.index({ licenseType: 1 });
licenseSchema.index({ tags: 1 });

export const License: Model<ILicenseDocument> = mongoose.model<ILicenseDocument>('License', licenseSchema);
