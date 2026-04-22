import mongoose, { type Document, type Model } from 'mongoose';

// ── MonitorCheck ── time-series ping results, TTL 7 days ──────────────────────

export interface IMonitorCheck {
  sourceType: 'asset' | 'ipam';
  sourceId: mongoose.Types.ObjectId;
  status: 'up' | 'down';
  latencyMs: number | null;
  checkedAt: Date;
}

export interface IMonitorCheckDocument extends IMonitorCheck, Document {}

const monitorCheckSchema = new mongoose.Schema<IMonitorCheckDocument>({
  sourceType: { type: String, enum: ['asset', 'ipam'], required: true },
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['up', 'down'], required: true },
  latencyMs: { type: Number, default: null },
  checkedAt: { type: Date, required: true, default: Date.now },
});

monitorCheckSchema.index({ sourceType: 1, sourceId: 1, checkedAt: -1 });
monitorCheckSchema.index({ checkedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const MonitorCheck: Model<IMonitorCheckDocument> =
  mongoose.model<IMonitorCheckDocument>('MonitorCheck', monitorCheckSchema);

// ── MonitorState ── current state per asset (upserted each check) ─────────────

export interface IMonitorState {
  sourceType: 'asset' | 'ipam';
  sourceId: mongoose.Types.ObjectId;
  currentStatus: 'up' | 'down' | 'unknown';
  lastCheckedAt: Date | null;
  lastLatencyMs: number | null;
  statusChangedAt: Date;
  downAlertSentAt: Date | null;
}

export interface IMonitorStateDocument extends IMonitorState, Document {}

const monitorStateSchema = new mongoose.Schema<IMonitorStateDocument>({
  sourceType: { type: String, enum: ['asset', 'ipam'], required: true },
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  currentStatus: { type: String, enum: ['up', 'down', 'unknown'], default: 'unknown' },
  lastCheckedAt: { type: Date, default: null },
  lastLatencyMs: { type: Number, default: null },
  statusChangedAt: { type: Date, default: Date.now },
  downAlertSentAt: { type: Date, default: null },
});

monitorStateSchema.index({ sourceType: 1, sourceId: 1 }, { unique: true });

export const MonitorState: Model<IMonitorStateDocument> =
  mongoose.model<IMonitorStateDocument>('MonitorState', monitorStateSchema);
