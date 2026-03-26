import mongoose, { type Document, type Model } from 'mongoose';
import { AssetType, AssetStatus, ExternalSource } from '@itdesk/shared';

export interface IAsset {
  assetTag: string;
  name: string;
  type: string;
  status: string;
  assignedTo?: mongoose.Types.ObjectId;
  assignedContact?: mongoose.Types.ObjectId;
  location?: string;
  manufacturer?: string;
  modelName?: string;
  serialNumber?: string;
  purchaseDate?: Date;
  warrantyExpiry?: Date;
  purchaseCost?: number;
  specs?: {
    cpu?: string;
    ram?: string;
    storage?: string;
    os?: string;
    osVersion?: string;
    ipAddress?: string;
    macAddress?: string;
  };
  license?: {
    key?: string;
    seats?: number;
    seatsUsed?: number;
    expiryDate?: Date;
    vendor?: string;
  };
  network?: {
    ipAddress?: string;
    macAddress?: string;
    vlan?: number;
    port?: string;
    connectedTo?: mongoose.Types.ObjectId;
  };
  networkId?: mongoose.Types.ObjectId;
  vendorId?: mongoose.Types.ObjectId;
  notes?: string;
  externalSource?: string;
  externalId?: string;
  lastSyncedAt?: Date;
  customFields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAssetDocument extends IAsset, Document {}

const assetSchema = new mongoose.Schema<IAssetDocument>(
  {
    assetTag: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: Object.values(AssetType) },
    status: { type: String, required: true, enum: Object.values(AssetStatus), default: AssetStatus.ACTIVE },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedContact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    location: String,
    manufacturer: String,
    modelName: String,
    serialNumber: String,
    purchaseDate: Date,
    warrantyExpiry: Date,
    purchaseCost: Number,
    specs: {
      cpu: String,
      ram: String,
      storage: String,
      os: String,
      osVersion: String,
      ipAddress: String,
      macAddress: String,
    },
    license: {
      key: String,
      seats: Number,
      seatsUsed: Number,
      expiryDate: Date,
      vendor: String,
    },
    network: {
      ipAddress: String,
      macAddress: String,
      vlan: Number,
      port: String,
      connectedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
    },
    networkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Network' },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    notes: String,
    externalSource: { type: String, enum: Object.values(ExternalSource) },
    externalId: String,
    lastSyncedAt: Date,
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

assetSchema.index({ type: 1 });
assetSchema.index({ status: 1 });
assetSchema.index({ assignedTo: 1 });
assetSchema.index({ networkId: 1 });
assetSchema.index({ externalSource: 1, externalId: 1 });


export const Asset: Model<IAssetDocument> = mongoose.model<IAssetDocument>('Asset', assetSchema);
