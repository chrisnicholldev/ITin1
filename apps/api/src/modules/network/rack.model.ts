import mongoose, { type Document, type Model } from 'mongoose';

// ── Rack ──────────────────────────────────────────────────────────────────────

export interface IRack {
  name: string;
  location: string;
  totalU: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRackDocument extends IRack, Document {}

const rackSchema = new mongoose.Schema<IRackDocument>(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    totalU: { type: Number, required: true, default: 42 },
    notes: String,
  },
  { timestamps: true },
);

rackSchema.index({ location: 1 });

export const Rack: Model<IRackDocument> = mongoose.model<IRackDocument>('Rack', rackSchema);

// ── RackMount ─────────────────────────────────────────────────────────────────

export interface IRackMount {
  rack: mongoose.Types.ObjectId;
  asset?: mongoose.Types.ObjectId;
  label?: string;
  startU: number;
  endU: number;
  face: 'front' | 'back' | 'both';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRackMountDocument extends IRackMount, Document {}

const rackMountSchema = new mongoose.Schema<IRackMountDocument>(
  {
    rack: { type: mongoose.Schema.Types.ObjectId, ref: 'Rack', required: true },
    asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
    label: String,
    startU: { type: Number, required: true },
    endU: { type: Number, required: true },
    face: { type: String, enum: ['front', 'back', 'both'], default: 'both' },
    notes: String,
  },
  { timestamps: true },
);

rackMountSchema.index({ rack: 1, startU: 1 });

export const RackMount: Model<IRackMountDocument> = mongoose.model<IRackMountDocument>(
  'RackMount',
  rackMountSchema,
);
