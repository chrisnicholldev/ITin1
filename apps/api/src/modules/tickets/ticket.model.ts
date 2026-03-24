import mongoose, { type Document, type Model } from 'mongoose';
import { TicketStatus, TicketPriority, TicketSource } from '@itdesk/shared';

export interface IComment {
  _id: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  body: string;
  isInternal: boolean;
  createdAt: Date;
}

export interface IAttachment {
  _id: mongoose.Types.ObjectId;
  filename: string;
  storagePath: string;
  mimeType: string;
  size: number;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
}

export interface ITicket {
  ticketNumber: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  source: string;
  category: mongoose.Types.ObjectId;
  subcategory?: string;
  submittedBy: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  assignedTeam?: string;
  relatedAssets: mongoose.Types.ObjectId[];
  comments: IComment[];
  attachments: IAttachment[];
  tags: string[];
  slaDeadline?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITicketDocument extends ITicket, Document {}

const commentSchema = new mongoose.Schema<IComment>(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
    isInternal: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const attachmentSchema = new mongoose.Schema<IAttachment>(
  {
    filename: { type: String, required: true },
    storagePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const ticketSchema = new mongoose.Schema<ITicketDocument>(
  {
    ticketNumber: { type: String, unique: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(TicketStatus),
      default: TicketStatus.OPEN,
    },
    priority: {
      type: String,
      enum: Object.values(TicketPriority),
      default: TicketPriority.MEDIUM,
    },
    source: {
      type: String,
      enum: Object.values(TicketSource),
      default: TicketSource.WEB,
    },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subcategory: String,
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTeam: String,
    relatedAssets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Asset' }],
    comments: [commentSchema],
    attachments: [attachmentSchema],
    tags: [String],
    slaDeadline: Date,
    resolvedAt: Date,
    closedAt: Date,
  },
  { timestamps: true },
);

ticketSchema.index({ status: 1 });
ticketSchema.index({ priority: 1 });
ticketSchema.index({ submittedBy: 1 });
ticketSchema.index({ assignedTo: 1 });
ticketSchema.index({ category: 1 });
ticketSchema.index({ createdAt: -1 });

// Auto-generate ticket number before save
ticketSchema.pre('save', async function (next) {
  if (this.isNew && !this.ticketNumber) {
    const count = await mongoose.model('Ticket').countDocuments();
    this.ticketNumber = `TKT-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

export const Ticket: Model<ITicketDocument> = mongoose.model<ITicketDocument>(
  'Ticket',
  ticketSchema,
);
