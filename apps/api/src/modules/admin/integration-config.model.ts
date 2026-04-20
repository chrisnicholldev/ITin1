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
  ad: {
    enabled: boolean;
    url?: string;           // ldap://dc.domain.local
    bindDn?: string;        // CN=svc-itdesk,OU=Service Accounts,DC=domain,DC=local
    bindCredentialsEnc?: string; // AES-GCM encrypted JSON
    searchBase?: string;    // DC=domain,DC=local
    computerFilter?: string; // (objectClass=computer) — customisable
    syncSchedule?: string;
  };
  smtp: {
    enabled: boolean;
    host?: string;
    port?: number;
    user?: string;
    passEnc?: string; // AES-GCM encrypted JSON
    from?: string;
  };
  imap: {
    enabled: boolean;
    host?: string;
    port?: number;
    user?: string;
    passEnc?: string; // AES-GCM encrypted JSON
    folder?: string;
    defaultCategoryId?: string;
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
    ad: {
      enabled: { type: Boolean, default: false },
      url: String,
      bindDn: String,
      bindCredentialsEnc: String,
      searchBase: String,
      computerFilter: String,
      syncSchedule: String,
    },
    smtp: {
      enabled: { type: Boolean, default: false },
      host: String,
      port: Number,
      user: String,
      passEnc: String,
      from: String,
    },
    imap: {
      enabled: { type: Boolean, default: false },
      host: String,
      port: Number,
      user: String,
      passEnc: String,
      folder: String,
      defaultCategoryId: String,
    },
  },
  { timestamps: true },
);

export const IntegrationConfig: Model<IIntegrationConfigDocument> =
  mongoose.model<IIntegrationConfigDocument>('IntegrationConfig', schema);

export const INTEGRATION_CONFIG_ID = 'integration_config';
