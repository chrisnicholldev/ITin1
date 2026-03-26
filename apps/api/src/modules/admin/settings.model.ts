import mongoose, { type Document, type Model } from 'mongoose';

export interface IOrgSettings {
  orgName: string;
  orgLogoUrl?: string;
}

export interface IOrgSettingsDocument extends IOrgSettings, Document {}

const orgSettingsSchema = new mongoose.Schema<IOrgSettingsDocument>(
  {
    _id: { type: mongoose.Schema.Types.Mixed },
    orgName: { type: String, default: 'IT Helpdesk', trim: true },
    orgLogoUrl: { type: String },
  },
  { timestamps: true },
);

export const OrgSettings: Model<IOrgSettingsDocument> = mongoose.model<IOrgSettingsDocument>(
  'OrgSettings',
  orgSettingsSchema,
);

const SINGLETON_ID = 'org_settings';

export async function getOrgSettings(): Promise<{ orgName: string; orgLogoUrl?: string }> {
  const doc = await OrgSettings.findById(SINGLETON_ID);
  return { orgName: doc?.orgName ?? 'IT Helpdesk', orgLogoUrl: doc?.orgLogoUrl };
}

export async function updateOrgSettings(data: { orgName?: string; orgLogoUrl?: string }): Promise<{ orgName: string; orgLogoUrl?: string }> {
  const doc = await OrgSettings.findByIdAndUpdate(
    SINGLETON_ID,
    { $set: { _id: SINGLETON_ID, ...data } },
    { upsert: true, new: true },
  );
  return { orgName: doc.orgName, orgLogoUrl: doc.orgLogoUrl };
}
