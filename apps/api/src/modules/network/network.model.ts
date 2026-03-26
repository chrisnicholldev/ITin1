import mongoose, { type Document, type Model } from 'mongoose';

export interface INetwork {
  name: string;
  address: string;
  vlanId?: number;
  gateway?: string;
  dnsServers: string[];
  dhcpEnabled: boolean;
  dhcpRange?: string;
  location?: mongoose.Types.ObjectId;
  description?: string;
  notes?: string;
  externalSource?: string;
  externalId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface INetworkDocument extends INetwork, Document {}

const networkSchema = new mongoose.Schema<INetworkDocument>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    vlanId: Number,
    gateway: String,
    dnsServers: { type: [String], default: [] },
    dhcpEnabled: { type: Boolean, default: false },
    dhcpRange: String,
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    description: String,
    notes: String,
    externalSource: String,
    externalId: String,
  },
  { timestamps: true },
);

networkSchema.index({ name: 1 });
networkSchema.index({ address: 1 });
networkSchema.index({ location: 1 });
networkSchema.index({ externalSource: 1, externalId: 1 });

export const Network: Model<INetworkDocument> = mongoose.model<INetworkDocument>('Network', networkSchema);
