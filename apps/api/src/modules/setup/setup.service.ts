import bcrypt from 'bcryptjs';
import { OrgSettings, SINGLETON_ID } from '../admin/settings.model.js';
import { updateSmtpConfig } from '../admin/integration-config.service.js';
import { User } from '../users/user.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import { AuthProvider, UserRole } from '@itdesk/shared';

export async function getSetupStatus(): Promise<{ complete: boolean }> {
  const doc = await OrgSettings.findById(SINGLETON_ID);
  return { complete: doc?.setupComplete ?? false };
}

export async function completeSetup(input: {
  orgName: string;
  adminDisplayName: string;
  adminEmail: string;
  adminUsername: string;
  adminPassword: string;
  smtp?: {
    enabled: boolean;
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };
}) {
  const status = await getSetupStatus();
  if (status.complete) throw new AppError(409, 'Setup has already been completed');

  // Hash the admin password
  const passwordHash = await bcrypt.hash(input.adminPassword, 12);

  // Update the default seeded admin if it exists, otherwise create
  const existing = await User.findOne({ role: UserRole.SUPER_ADMIN });
  if (existing) {
    existing.displayName = input.adminDisplayName;
    existing.email = input.adminEmail;
    existing.username = input.adminUsername.toLowerCase().trim();
    existing.passwordHash = passwordHash;
    await existing.save();
  } else {
    await User.create({
      displayName: input.adminDisplayName,
      email: input.adminEmail,
      username: input.adminUsername.toLowerCase().trim(),
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      authProvider: AuthProvider.LOCAL,
      isActive: true,
    });
  }

  // Set org name and mark setup complete
  await OrgSettings.findByIdAndUpdate(
    SINGLETON_ID,
    { $set: { _id: SINGLETON_ID, orgName: input.orgName.trim(), setupComplete: true } },
    { upsert: true, new: true },
  );

  // Configure SMTP if provided
  if (input.smtp?.host?.trim()) {
    await updateSmtpConfig({
      enabled: input.smtp.enabled,
      host: input.smtp.host,
      port: input.smtp.port,
      user: input.smtp.user,
      pass: input.smtp.pass,
      from: input.smtp.from,
    });
  }

  return { success: true };
}
