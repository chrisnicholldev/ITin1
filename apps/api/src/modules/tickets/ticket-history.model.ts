import mongoose, { type Document, type Model } from 'mongoose';

export type TicketHistoryAction =
  | 'created'
  | 'updated'
  | 'comment_added'
  | 'comment_deleted'
  | 'attachment_added'
  | 'attachment_deleted';

export interface ITicketHistoryChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface ITicketHistory {
  ticket: mongoose.Types.ObjectId;
  actor: mongoose.Types.ObjectId;
  action: TicketHistoryAction;
  changes: ITicketHistoryChange[];
  createdAt: Date;
}

export interface ITicketHistoryDocument extends ITicketHistory, Document {}

const ticketHistorySchema = new mongoose.Schema<ITicketHistoryDocument>(
  {
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
      type: String,
      required: true,
      enum: ['created', 'updated', 'comment_added', 'comment_deleted', 'attachment_added', 'attachment_deleted'],
    },
    changes: [
      {
        field: { type: String, required: true },
        from: { type: mongoose.Schema.Types.Mixed },
        to: { type: mongoose.Schema.Types.Mixed },
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ticketHistorySchema.index({ ticket: 1, createdAt: -1 });
ticketHistorySchema.index({ actor: 1 });

export const TicketHistory: Model<ITicketHistoryDocument> = mongoose.model<ITicketHistoryDocument>(
  'TicketHistory',
  ticketHistorySchema,
);
