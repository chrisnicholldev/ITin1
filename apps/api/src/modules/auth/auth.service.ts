import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { User } from '../users/user.model.js';
import { signAccessToken, signTempToken, verifyTempToken } from '../../config/jwt.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/error.middleware.js';
import { AuthProvider, UserRole } from '@itdesk/shared';
import ldap from 'ldapjs';
import { sendMail } from '../../lib/mailer.js';
import {
  generateSecret,
  generateQRCodeDataUrl,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyTOTP,
} from './totp.service.js';

// Roles that must complete 2FA before receiving full tokens
const ADMIN_ROLES = new Set<string>([UserRole.IT_ADMIN, UserRole.SUPER_ADMIN]);

async function hashToken(token: string): Promise<string> {
  return createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken(): string {
  return randomBytes(40).toString('hex');
}

export type LoginResult =
  | { accessToken: string; refreshToken: string }
  | { twoFactorRequired: true; tempToken: string }
  | { setupRequired: true; tempToken: string };

async function resolveLoginResult(userId: string, role: string): Promise<LoginResult> {
  if (!ADMIN_ROLES.has(role as UserRole)) {
    return issueTokens(userId, role);
  }

  // Admin: check 2FA status (need secret fields)
  const user = await User.findById(userId).select('+twoFactorEnabled +twoFactorSecret');
  if (!user) throw new AppError(401, 'User not found');

  const tempToken = await signTempToken({ sub: userId, role, purpose: '2fa' });

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    return { twoFactorRequired: true, tempToken };
  }

  // Admin hasn't set up 2FA yet — require setup before granting access
  return { setupRequired: true, tempToken };
}

export async function loginLocal(username: string, password: string): Promise<LoginResult> {
  const user = await User.findOne({
    username: username.toLowerCase(),
    authProvider: AuthProvider.LOCAL,
    isActive: true,
  }).select('+passwordHash');

  if (!user || !user.passwordHash) throw new AppError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  return resolveLoginResult(user.id as string, user.role);
}

export async function loginLdap(username: string, password: string): Promise<LoginResult> {
  if (!env.LDAP_URL || !env.LDAP_BIND_DN || !env.LDAP_BIND_CREDENTIALS || !env.LDAP_SEARCH_BASE) {
    throw new AppError(503, 'LDAP not configured');
  }

  const ldapUser = await authenticateWithLdap(username, password);
  const role = await resolveRoleFromGroups(ldapUser.groups ?? []);

  const user = await User.findOneAndUpdate(
    { username: username.toLowerCase() },
    {
      $set: {
        email: ldapUser.mail ?? `${username}@domain.local`,
        displayName: ldapUser.displayName ?? username,
        username: username.toLowerCase(),
        authProvider: AuthProvider.LDAP,
        role,
        department: ldapUser.department,
        title: ldapUser.title,
        ldapDn: ldapUser.dn,
        isActive: true,
        lastLogin: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  return resolveLoginResult(user.id as string, user.role);
}

/** Verify a TOTP code (or recovery code) from the 2FA login step. */
export async function verifyTwoFactorLogin(
  tempToken: string,
  code: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const payload = await verifyTempToken(tempToken).catch(() => {
    throw new AppError(401, 'Invalid or expired session — please log in again');
  });

  const user = await User.findById(payload.sub).select('+twoFactorSecret +twoFactorRecoveryCodes');
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new AppError(401, 'Two-factor authentication not configured');
  }

  // Try TOTP first, then recovery codes
  const totpValid = verifyTOTP(user.twoFactorSecret, code.replace(/\s/g, ''));
  if (totpValid) return issueTokens(user.id as string, user.role);

  // Check recovery codes
  const codeHash = hashRecoveryCode(code);
  const codes = user.twoFactorRecoveryCodes ?? [];
  const idx = codes.indexOf(codeHash);
  if (idx === -1) throw new AppError(401, 'Invalid authentication code');

  // Consume the recovery code
  codes.splice(idx, 1);
  await User.findByIdAndUpdate(user.id, { $set: { twoFactorRecoveryCodes: codes } });

  return issueTokens(user.id as string, user.role);
}

/** Generate a TOTP secret and QR code for setup. Works during login (tempToken) or for logged-in users. */
export async function initiateTwoFactorSetup(
  userId: string,
): Promise<{ qrCodeDataUrl: string; secret: string }> {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'User not found');

  const secret = generateSecret();
  await User.findByIdAndUpdate(userId, { $set: { twoFactorPendingSecret: secret } });

  const qrCodeDataUrl = await generateQRCodeDataUrl(secret, user.email);
  return { qrCodeDataUrl, secret };
}

/** Confirm a TOTP code against the pending secret, enable 2FA, and return recovery codes + full tokens. */
export async function confirmTwoFactorSetup(
  userId: string,
  code: string,
  tempToken?: string,
): Promise<{ recoveryCodes: string[]; accessToken?: string; refreshToken?: string }> {
  const user = await User.findById(userId).select('+twoFactorPendingSecret');
  if (!user || !user.twoFactorPendingSecret) {
    throw new AppError(400, 'No pending 2FA setup — call setup first');
  }

  if (!verifyTOTP(user.twoFactorPendingSecret, code.replace(/\s/g, ''))) {
    throw new AppError(400, 'Invalid code — check your authenticator app and try again');
  }

  const { plain, hashed } = generateRecoveryCodes();

  await User.findByIdAndUpdate(userId, {
    $set: {
      twoFactorEnabled: true,
      twoFactorSecret: user.twoFactorPendingSecret,
      twoFactorRecoveryCodes: hashed,
    },
    $unset: { twoFactorPendingSecret: 1 },
  });

  // If called during login (tempToken provided), also issue full tokens
  if (tempToken) {
    const tokens = await issueTokens(userId, user.role);
    return { recoveryCodes: plain, ...tokens };
  }

  return { recoveryCodes: plain };
}

/** Disable 2FA for a user. Requires a valid TOTP code as confirmation. */
export async function disableTwoFactor(userId: string, code: string): Promise<void> {
  const user = await User.findById(userId).select('+twoFactorSecret');
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new AppError(400, '2FA is not enabled');
  }

  if (!verifyTOTP(user.twoFactorSecret, code.replace(/\s/g, ''))) {
    throw new AppError(401, 'Invalid code');
  }

  await User.findByIdAndUpdate(userId, {
    $set: { twoFactorEnabled: false },
    $unset: { twoFactorSecret: 1, twoFactorRecoveryCodes: 1, twoFactorPendingSecret: 1 },
  });
}

export async function issueTokens(userId: string, role: string): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await signAccessToken({ sub: userId, role });
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashToken(refreshToken);

  await User.findByIdAndUpdate(userId, {
    $set: { refreshTokenHash, lastLogin: new Date() },
  });

  return { accessToken, refreshToken };
}

export async function refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const hash = await hashToken(refreshToken);
  const user = await User.findOne({ refreshTokenHash: hash, isActive: true }).select('+refreshTokenHash');
  if (!user) throw new AppError(401, 'Invalid refresh token');
  return issueTokens(user.id as string, user.role);
}

export async function logout(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
}

export async function createLocalUser(data: {
  email: string;
  username: string;
  displayName: string;
  password: string;
  role?: string;
}): Promise<void> {
  const existing = await User.findOne({ $or: [{ email: data.email }, { username: data.username }] });
  if (existing) throw new AppError(409, 'User with that email or username already exists');

  const passwordHash = await bcrypt.hash(data.password, 12);
  await User.create({ ...data, passwordHash, authProvider: AuthProvider.LOCAL });
}

export async function bootstrapSuperAdmin(): Promise<void> {
  const count = await User.countDocuments();
  if (count > 0) return;

  console.log('[auth] No users found — creating default super admin');
  await createLocalUser({
    email: 'admin@itdesk.local',
    username: 'admin',
    displayName: 'Super Admin',
    password: 'changeme123!',
    role: UserRole.SUPER_ADMIN,
  });
  console.log('[auth] Default admin created: admin@itdesk.local / changeme123!');
  console.log('[auth] IMPORTANT: Change this password immediately!');
}

// ── Password reset ────────────────────────────────────────────────────────────

const RESET_TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

export async function requestPasswordReset(email: string, appBaseUrl: string): Promise<void> {
  const user = await User.findOne({
    email: email.toLowerCase(),
    authProvider: AuthProvider.LOCAL,
    isActive: true,
  });

  // Always resolve successfully — never reveal whether an email exists
  if (!user) return;

  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  await User.findByIdAndUpdate(user.id, {
    $set: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
    },
  });

  const resetUrl = `${appBaseUrl}/reset-password?token=${token}`;

  await sendMail(
    user.email,
    'Reset your ITin1 password',
    `<p>Hi ${user.displayName},</p>
<p>A password reset was requested for your account. Click the link below to set a new password. This link expires in 30 minutes.</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>If you did not request this, you can safely ignore this email.</p>`,
  );
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    authProvider: AuthProvider.LOCAL,
    isActive: true,
  }).select('+passwordResetTokenHash +passwordResetExpires');

  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    throw new AppError(400, 'Reset link is invalid or has expired');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await User.findByIdAndUpdate(user.id, {
    $set: { passwordHash },
    $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1, refreshTokenHash: 1 },
  });
}

// ── LDAP helpers ─────────────────────────────────────────────────────────────

async function authenticateWithLdap(username: string, password: string): Promise<{
  dn: string; mail?: string; displayName?: string; department?: string; title?: string; groups?: string[];
}> {
  return new Promise((resolve, reject) => {
    const serviceClient = ldap.createClient({ url: env.LDAP_URL! });

    serviceClient.bind(env.LDAP_BIND_DN!, env.LDAP_BIND_CREDENTIALS!, (bindErr) => {
      if (bindErr) { serviceClient.destroy(); return reject(new AppError(503, 'LDAP service bind failed')); }

      const filter = env.LDAP_SEARCH_FILTER!.replace('{{username}}', username);
      serviceClient.search(
        env.LDAP_SEARCH_BASE!,
        { filter, scope: 'sub', attributes: ['dn', 'mail', 'displayName', 'department', 'title', 'memberOf'] },
        (searchErr, searchRes) => {
          if (searchErr) { serviceClient.destroy(); return reject(new AppError(401, 'Invalid credentials')); }

          let entry: ldap.SearchEntry | null = null;
          searchRes.on('searchEntry', (e) => { entry = e; });
          searchRes.on('error', () => { serviceClient.destroy(); reject(new AppError(401, 'Invalid credentials')); });
          searchRes.on('end', () => {
            serviceClient.destroy();
            if (!entry) return reject(new AppError(401, 'Invalid credentials'));

            const e = entry as ldap.SearchEntry;
            const attrs = e.pojo.attributes;
            const get = (name: string) => attrs.find((a) => a.type === name)?.values[0];
            const getAll = (name: string) => attrs.find((a) => a.type === name)?.values ?? [];
            const userDn = e.dn.toString();

            const userClient = ldap.createClient({ url: env.LDAP_URL! });
            userClient.bind(userDn, password, (userBindErr) => {
              userClient.destroy();
              if (userBindErr) return reject(new AppError(401, 'Invalid credentials'));
              resolve({ dn: userDn, mail: get('mail'), displayName: get('displayName'), department: get('department'), title: get('title'), groups: getAll('memberOf') });
            });
          });
        },
      );
    });
  });
}

async function resolveRoleFromGroups(groups: string[]): Promise<string> {
  if (env.LDAP_ADMIN_GROUP && groups.includes(env.LDAP_ADMIN_GROUP)) return UserRole.IT_ADMIN;
  if (env.LDAP_TECH_GROUP && groups.includes(env.LDAP_TECH_GROUP)) return UserRole.IT_TECHNICIAN;
  return UserRole.END_USER;
}
