import mongoose, { type Document, type Model } from 'mongoose';

export interface IArticle {
  title: string;
  slug: string;
  body: string;
  bodyText: string;
  folder: mongoose.Types.ObjectId;
  linkedAssets: mongoose.Types.ObjectId[];
  linkedLocation?: mongoose.Types.ObjectId;
  tags: string[];
  publishedAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IArticleDocument extends IArticle, Document {}

const articleSchema = new mongoose.Schema<IArticleDocument>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    body: { type: String, default: '' },
    bodyText: { type: String, default: '' },
    folder: { type: mongoose.Schema.Types.ObjectId, ref: 'DocFolder', required: true },
    linkedAssets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Asset' }],
    linkedLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    tags: [{ type: String }],
    publishedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

articleSchema.index({ folder: 1 });
articleSchema.index({ tags: 1 });
articleSchema.index({ linkedAssets: 1 });
articleSchema.index({ linkedLocation: 1 });
articleSchema.index({ title: 'text', bodyText: 'text' }, { weights: { title: 10, bodyText: 1 } });

export const Article: Model<IArticleDocument> = mongoose.model<IArticleDocument>('Article', articleSchema);
