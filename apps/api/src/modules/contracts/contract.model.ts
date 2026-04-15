import mongoose, { type Document, type Model } from 'mongoose';

export interface IContract {
  name: string;
  contractType: 'vendor_contract' | 'warranty' | 'maintenance' | 'support' | 'insurance' | 'lease' | 'other';
  vendor?: mongoose.Types.ObjectId;
  vendorName?: string;
  asset?: mongoose.Types.ObjectId;
  contractNumber?: string;
  value?: number;
  startDate?: Date;
  endDate?: Date;
  autoRenews: boolean;
  noticePeriodDays?: number;
  contactName?: string;
  contactEmail?: string;
  documentUrl?: string;
  notes?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IContractDocument extends IContract, Document {}

const contractSchema = new mongoose.Schema<IContractDocument>(
  {
    name:             { type: String, required: true, trim: true },
    contractType:     { type: String, enum: ['vendor_contract', 'warranty', 'maintenance', 'support', 'insurance', 'lease', 'other'], default: 'vendor_contract' },
    vendor:           { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    vendorName:       { type: String, trim: true },
    asset:            { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
    contractNumber:   { type: String, trim: true },
    value:            { type: Number },
    startDate:        { type: Date },
    endDate:          { type: Date },
    autoRenews:       { type: Boolean, default: false },
    noticePeriodDays: { type: Number },
    contactName:      { type: String, trim: true },
    contactEmail:     { type: String, trim: true },
    documentUrl:      { type: String },
    notes:            { type: String },
    tags:             [{ type: String }],
  },
  { timestamps: true },
);

contractSchema.index({ contractType: 1 });
contractSchema.index({ endDate: 1 });
contractSchema.index({ vendor: 1 });
contractSchema.index({ asset: 1 });
contractSchema.index({ tags: 1 });

export const Contract: Model<IContractDocument> = mongoose.model<IContractDocument>('Contract', contractSchema);
