import mongoose, { type Document, type Model } from 'mongoose';

export interface IOrgSettings {
  orgName: string;
}

export interface IOrgSettingsDocument extends IOrgSettings, Document {}

const orgSettingsSchema = new mongoose.Schema<IOrgSettingsDocument>(
  {
    _id: { type: mongoose.Schema.Types.Mixed },
    orgName: { type: String, default: 'IT Helpdesk', trim: true },
  },
  { timestamps: true },
);

export const OrgSettings: Model<IOrgSettingsDocument> = mongoose.model<IOrgSettingsDocument>(
  'OrgSettings',
  orgSettingsSchema,
);

const SINGLETON_ID = 'org_settings';

export async function getOrgSettings(): Promise<{ orgName: string }> {
  const doc = await OrgSettings.findById(SINGLETON_ID);
  return { orgName: doc?.orgName ?? 'IT Helpdesk' };
}

export async function updateOrgSettings(data: { orgName?: string }): Promise<{ orgName: string }> {
  const doc = await OrgSettings.findByIdAndUpdate(
    SINGLETON_ID,
    { $set: { _id: SINGLETON_ID, ...data } },
    { upsert: true, new: true },
  );
  return { orgName: doc.orgName };
}
