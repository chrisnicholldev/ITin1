import type { Request, Response } from 'express';
import {
  loginLocal,
  loginLdap,
  refreshTokens,
  logout,
  verifyTwoFactorLogin,
  initiateTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
} from './auth.service.js';
import { verifyTempToken } from '../../config/jwt.js';
import { User } from '../users/user.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { env } from '../../config/env.js';
import { LoginSchema } from '@itdesk/shared';
import { generateState, getAuthorizationUrl, handleAzureCallback } from './azure-auth.service.js';

const REFRESH_COOKIE = 'refresh_token';

const cookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
};

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = LoginSchema.parse(req.body);

  let result: Awaited<ReturnType<typeof loginLocal>>;

  if (env.LDAP_ENABLED) {
    try {
      result = await loginLdap(username, password);
    } catch {
      result = await loginLocal(username, password);
    }
  } else {
    result = await loginLocal(username, password);
  }

  if ('twoFactorRequired' in result) {
    res.json({ twoFactorRequired: true, tempToken: result.tempToken });
    return;
  }

  if ('setupRequired' in result) {
    res.json({ setupRequired: true, tempToken: result.tempToken });
    return;
  }

  res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions);
  res.json({ accessToken: result.accessToken, expiresIn: 15 * 60 });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies[REFRESH_COOKIE] as string | undefined;
  if (!token) throw new AppError(401, 'No refresh token');

  const tokens = await refreshTokens(token);

  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
  res.json({ accessToken: tokens.accessToken, expiresIn: 15 * 60 });
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const user = (req as AuthenticatedRequest).user;
  await logout(user.id);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  const { id } = (req as AuthenticatedRequest).user;
  const user = await User.findById(id);
  if (!user) throw new AppError(404, 'User not found');

  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    username: user.username,
    role: user.role,
    authProvider: user.authProvider,
    department: user.department,
    title: user.title,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    lastLogin: user.lastLogin,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
}

// ── Azure AD OAuth ────────────────────────────────────────────────────────────

const AZURE_STATE_COOKIE = 'azure_oauth_state';
const AZURE_STATE_TTL = 10 * 60 * 1000; // 10 minutes

export function azureRedirect(req: Request, res: Response): void {
  if (!env.AZURE_AD_ENABLED) {
    res.status(404).json({ error: 'Azure AD login is not enabled' });
    return;
  }
  const state = generateState();
  res.cookie(AZURE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    sameSite: 'lax', // 'lax' required for OAuth redirects
    maxAge: AZURE_STATE_TTL,
    path: '/',
  });
  res.redirect(getAuthorizationUrl(state));
}

export async function azureCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error, error_description } = req.query as Record<string, string>;

  const frontendBase = env.CLIENT_URL;

  if (error) {
    res.redirect(`${frontendBase}/login?error=${encodeURIComponent(error_description ?? error)}`);
    return;
  }

  const storedState = req.cookies[AZURE_STATE_COOKIE] as string | undefined;
  res.clearCookie(AZURE_STATE_COOKIE, { path: '/' });

  if (!storedState || storedState !== state) {
    res.redirect(`${frontendBase}/login?error=${encodeURIComponent('Invalid OAuth state — please try again')}`);
    return;
  }

  if (!code) {
    res.redirect(`${frontendBase}/login?error=${encodeURIComponent('No authorisation code received')}`);
    return;
  }

  const tokens = await handleAzureCallback(code);

  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
  // Pass the short-lived access token to the frontend via URL fragment (never lands in server logs)
  res.redirect(`${frontendBase}/auth/callback#token=${tokens.accessToken}`);
}

// ── 2FA endpoints ─────────────────────────────────────────────────────────────

/** Resolve userId from either a tempToken in the body or the authenticated session. */
async function resolveUserId(req: Request): Promise<string> {
  const { tempToken } = req.body as { tempToken?: string };
  if (tempToken) {
    const payload = await verifyTempToken(tempToken).catch(() => {
      throw new AppError(401, 'Invalid or expired session — please log in again');
    });
    return payload.sub;
  }
  const authed = (req as AuthenticatedRequest).user;
  if (authed?.id) return authed.id;
  throw new AppError(401, 'Unauthorised');
}

/** POST /auth/2fa/verify — complete login with TOTP code */
export async function twoFactorVerify(req: Request, res: Response): Promise<void> {
  const { tempToken, code } = req.body as { tempToken: string; code: string };
  if (!tempToken || !code) throw new AppError(400, 'tempToken and code are required');

  const tokens = await verifyTwoFactorLogin(tempToken, code);
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
  res.json({ accessToken: tokens.accessToken, expiresIn: 15 * 60 });
}

/** POST /auth/2fa/setup — generate QR code and pending secret */
export async function twoFactorSetup(req: Request, res: Response): Promise<void> {
  const userId = await resolveUserId(req);
  const result = await initiateTwoFactorSetup(userId);
  res.json(result);
}

/** POST /auth/2fa/confirm — verify first code and enable 2FA */
export async function twoFactorConfirm(req: Request, res: Response): Promise<void> {
  const { tempToken, code } = req.body as { tempToken?: string; code: string };
  if (!code) throw new AppError(400, 'code is required');

  const userId = await resolveUserId(req);
  const result = await confirmTwoFactorSetup(userId, code, tempToken);

  if (result.accessToken && result.refreshToken) {
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions);
    res.json({ accessToken: result.accessToken, expiresIn: 15 * 60, recoveryCodes: result.recoveryCodes });
  } else {
    res.json({ recoveryCodes: result.recoveryCodes });
  }
}

/** DELETE /auth/2fa — disable 2FA (requires current TOTP code) */
export async function twoFactorDisable(req: Request, res: Response): Promise<void> {
  const { id } = (req as AuthenticatedRequest).user;
  const { code } = req.body as { code: string };
  if (!code) throw new AppError(400, 'code is required');

  await disableTwoFactor(id, code);
  res.status(204).send();
}
