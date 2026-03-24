import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { SignJWT } from 'jose';
import { User } from '../users/user.model.js';
import { signAccessToken } from '../../config/jwt.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/error.middleware.js';
import { AuthProvider, UserRole } from '@itdesk/shared';
import ldap from 'ldapjs';

async function hashToken(token: string): Promise<string> {
  return createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken(): string {
  return randomBytes(40).toString('hex');
}

export async function loginLocal(
  username: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const user = await User.findOne({
    username: username.toLowerCase(),
    authProvider: AuthProvider.LOCAL,
    isActive: true,
  }).select('+passwordHash');

  if (!user || !user.passwordHash) {
    throw new AppError(401, 'Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  return issueTokens(user.id as string, user.role);
}

export async function loginLdap(
  username: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
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

  return issueTokens(user.id as string, user.role);
}

async function authenticateWithLdap(
  username: string,
  password: string,
): Promise<{
  dn: string;
  mail?: string;
  displayName?: string;
  department?: string;
  title?: string;
  groups?: string[];
}> {
  return new Promise((resolve, reject) => {
    const serviceClient = ldap.createClient({ url: env.LDAP_URL! });

    serviceClient.bind(env.LDAP_BIND_DN!, env.LDAP_BIND_CREDENTIALS!, (bindErr) => {
      if (bindErr) {
        serviceClient.destroy();
        return reject(new AppError(503, 'LDAP service bind failed'));
      }

      const filter = env.LDAP_SEARCH_FILTER!.replace('{{username}}', username);
      serviceClient.search(
        env.LDAP_SEARCH_BASE!,
        { filter, scope: 'sub', attributes: ['dn', 'mail', 'displayName', 'department', 'title', 'memberOf'] },
        (searchErr, searchRes) => {
          if (searchErr) {
            serviceClient.destroy();
            return reject(new AppError(401, 'Invalid credentials'));
          }

          let entry: ldap.SearchEntry | null = null;
          searchRes.on('searchEntry', (e) => { entry = e; });
          searchRes.on('error', () => {
            serviceClient.destroy();
            reject(new AppError(401, 'Invalid credentials'));
          });
          searchRes.on('end', () => {
            serviceClient.destroy();
            if (!entry) return reject(new AppError(401, 'Invalid credentials'));

            const e = entry as ldap.SearchEntry;
            const userDn = e.dn.toString();
            const attrs = e.pojo.attributes;
            const get = (name: string) => attrs.find((a) => a.type === name)?.values[0];
            const getAll = (name: string) => attrs.find((a) => a.type === name)?.values ?? [];

            // Verify user password by binding as them
            const userClient = ldap.createClient({ url: env.LDAP_URL! });
            userClient.bind(userDn, password, (userBindErr) => {
              userClient.destroy();
              if (userBindErr) return reject(new AppError(401, 'Invalid credentials'));

              resolve({
                dn: userDn,
                mail: get('mail'),
                displayName: get('displayName'),
                department: get('department'),
                title: get('title'),
                groups: getAll('memberOf'),
              });
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

async function issueTokens(
  userId: string,
  role: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await signAccessToken({ sub: userId, role });
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashToken(refreshToken);

  await User.findByIdAndUpdate(userId, {
    $set: { refreshTokenHash, lastLogin: new Date() },
  });

  return { accessToken, refreshToken };
}

export async function refreshTokens(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const hash = await hashToken(refreshToken);
  const user = await User.findOne({ refreshTokenHash: hash, isActive: true }).select(
    '+refreshTokenHash',
  );

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
  const existing = await User.findOne({
    $or: [{ email: data.email }, { username: data.username }],
  });
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
