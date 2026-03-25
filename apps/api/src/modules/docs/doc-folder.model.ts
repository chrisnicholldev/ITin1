import mongoose, { type Document, type Model } from 'mongoose';

export interface IDocFolder {
  name: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDocFolderDocument extends IDocFolder, Document {}

const docFolderSchema = new mongoose.Schema<IDocFolderDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: String,
    icon: String,
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

docFolderSchema.index({ sortOrder: 1 });

export const DocFolder: Model<IDocFolderDocument> = mongoose.model<IDocFolderDocument>('DocFolder', docFolderSchema);
