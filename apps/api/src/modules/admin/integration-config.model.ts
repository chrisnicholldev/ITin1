import mongoose, { type Document, type Model } from 'mongoose';

export interface IIntegrationConfig {
  intune: {
    enabled: boolean;
    tenantId?: string;
    clientId?: string;
    clientSecretEnc?: string; // AES-GCM encrypted JSON
    syncSchedule?: string;
  };
  meraki: {
    enabled: boolean;
    apiKeyEnc?: string; // AES-GCM encrypted JSON
    orgId?: string;
    syncSchedule?: string;
  };
}

export interface IIntegrationConfigDocument extends IIntegrationConfig, Document {}

const schema = new mongoose.Schema<IIntegrationConfigDocument>(
  {
    _id: { type: mongoose.Schema.Types.Mixed },
    intune: {
      enabled: { type: Boolean, default: false },
      tenantId: String,
      clientId: String,
      clientSecretEnc: String,
      syncSchedule: String,
    },
    meraki: {
      enabled: { type: Boolean, default: false },
      apiKeyEnc: String,
      orgId: String,
      syncSchedule: String,
    },
  },
  { timestamps: true },
);

export const IntegrationConfig: Model<IIntegrationConfigDocument> =
  mongoose.model<IIntegrationConfigDocument>('IntegrationConfig', schema);

export const INTEGRATION_CONFIG_ID = 'integration_config';
