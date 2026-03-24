import mongoose, { type Document, type Model } from 'mongoose';
import { TicketPriority } from '@itdesk/shared';

export interface ICategory {
  name: string;
  description?: string;
  defaultPriority?: string;
  defaultAssignee?: mongoose.Types.ObjectId;
  subcategories: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategoryDocument extends ICategory, Document {}

const categorySchema = new mongoose.Schema<ICategoryDocument>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: String,
    defaultPriority: { type: String, enum: Object.values(TicketPriority) },
    defaultAssignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    subcategories: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Category: Model<ICategoryDocument> = mongoose.model<ICategoryDocument>(
  'Category',
  categorySchema,
);
