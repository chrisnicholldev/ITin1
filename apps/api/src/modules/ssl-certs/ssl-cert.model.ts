import mongoose, { type Document, type Model, Schema } from 'mongoose';

export interface ISslCertDocument extends Document {
  domain: string;
  port: number;
  commonName?: string;
  issuer?: string;
  issuedAt?: Date;
  expiresAt?: Date;
  sans: string[];
  notes?: string;
  status: 'valid' | 'expiring_soon' | 'expired' | 'error' | 'unknown';
  checkError?: string;
  lastCheckedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SslCertSchema = new Schema<ISslCertDocument>(
  {
    domain:       { type: String, required: true, trim: true },
    port:         { type: Number, default: 443 },
    commonName:   { type: String },
    issuer:       { type: String },
    issuedAt:     { type: Date },
    expiresAt:    { type: Date },
    sans:         { type: [String], default: [] },
    notes:        { type: String },
    status:       { type: String, enum: ['valid', 'expiring_soon', 'expired', 'error', 'unknown'], default: 'unknown' },
    checkError:   { type: String },
    lastCheckedAt:{ type: Date },
  },
  { timestamps: true },
);

SslCertSchema.index({ domain: 1 });
SslCertSchema.index({ expiresAt: 1 });
SslCertSchema.index({ status: 1 });

export const SslCert: Model<ISslCertDocument> = mongoose.model<ISslCertDocument>('SslCert', SslCertSchema);
