import mongoose, { type Document, type Model } from 'mongoose';

export interface IChangelogEntry {
  title: string;
  category: 'infrastructure' | 'network' | 'security' | 'software' | 'hardware' | 'user_management' | 'policy' | 'vendor' | 'other';
  description: string;
  performedBy?: string;
  occurredAt: Date;
  affectedSystems: string[];
  tags: string[];
  rollbackNotes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChangelogEntryDocument extends IChangelogEntry, Document {}

const changelogSchema = new mongoose.Schema<IChangelogEntryDocument>(
  {
    title:           { type: String, required: true, trim: true },
    category:        { type: String, enum: ['infrastructure', 'network', 'security', 'software', 'hardware', 'user_management', 'policy', 'vendor', 'other'], default: 'other' },
    description:     { type: String, required: true },
    performedBy:     { type: String, trim: true },
    occurredAt:      { type: Date, required: true, default: Date.now },
    affectedSystems: [{ type: String, trim: true }],
    tags:            [{ type: String }],
    rollbackNotes:   { type: String },
    createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

changelogSchema.index({ occurredAt: -1 });
changelogSchema.index({ category: 1 });
changelogSchema.index({ tags: 1 });
changelogSchema.index({ title: 'text', description: 'text' }, { weights: { title: 5, description: 1 } });

export const ChangelogEntry: Model<IChangelogEntryDocument> = mongoose.model<IChangelogEntryDocument>('ChangelogEntry', changelogSchema);
