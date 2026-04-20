import mongoose, { type Document, type Model } from 'mongoose';

export interface ICannedResponse {
  title: string;
  body: string;
  category?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICannedResponseDocument extends ICannedResponse, Document {}

const cannedResponseSchema = new mongoose.Schema<ICannedResponseDocument>(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

cannedResponseSchema.index({ title: 1 });
cannedResponseSchema.index({ category: 1 });

export const CannedResponse: Model<ICannedResponseDocument> = mongoose.model<ICannedResponseDocument>(
  'CannedResponse',
  cannedResponseSchema,
);
