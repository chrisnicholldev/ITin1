import mongoose, { type Document, type Model, Schema } from 'mongoose';

export interface IIpAddress {
  networkId: mongoose.Types.ObjectId;
  address: string;
  label: string;
  type: 'static' | 'reserved' | 'dhcp';
  assetId?: mongoose.Types.ObjectId;
  notes?: string;
  monitored: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IIpAddressDocument extends IIpAddress, Document {}

const IpAddressSchema = new Schema<IIpAddressDocument>(
  {
    networkId: { type: Schema.Types.ObjectId, ref: 'Network', required: true, index: true },
    address:   { type: String, required: true, trim: true },
    label:     { type: String, required: true, trim: true },
    type:      { type: String, enum: ['static', 'reserved', 'dhcp'], default: 'static' },
    assetId:   { type: Schema.Types.ObjectId, ref: 'Asset' },
    notes:     { type: String },
    monitored: { type: Boolean, default: false },
  },
  { timestamps: true },
);

IpAddressSchema.index({ networkId: 1, address: 1 }, { unique: true });

export const IpAddress: Model<IIpAddressDocument> = mongoose.model<IIpAddressDocument>('IpAddress', IpAddressSchema);
