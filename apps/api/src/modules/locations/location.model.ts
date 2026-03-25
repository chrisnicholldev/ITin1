import mongoose, { type Document, type Model } from 'mongoose';

export interface ILocation {
  name: string;
  shortCode?: string;
  address?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILocationDocument extends ILocation, Document {}

const locationSchema = new mongoose.Schema<ILocationDocument>(
  {
    name: { type: String, required: true, trim: true },
    shortCode: { type: String, trim: true },
    address: String,
    notes: String,
  },
  { timestamps: true },
);

locationSchema.index({ name: 1 }, { unique: true });

export const Location: Model<ILocationDocument> = mongoose.model<ILocationDocument>('Location', locationSchema);
