import crypto from 'crypto';
import { SecureShare } from './secure-share.model.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { sendMail } from '../../lib/mailer.js';
import { env } from '../../config/env.js';
import { Credential } from '../vault/vault.model.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function expiryLabel(hours: number) {
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = hours / 24;
  return `${days} day${days === 1 ? '' : 's'}`;
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createShare(input: {
  contentType: 'credential' | 'note';
  credentialId?: string;
  content?: string;
  recipientEmail: string;
  expiresInHours: number;
  viewLimit: number;
  createdBy: string;
  createdByName: string;
}) {
  let plaintext: string;
  let credentialTitle: string | undefined;

  if (input.contentType === 'credential') {
    if (!input.credentialId) throw new Error('Credential ID required');
    const cred = await Credential.findById(input.credentialId);
    if (!cred) throw new Error('Credential not found');
    plaintext = decrypt(cred.passwordIv, cred.encryptedPassword, cred.passwordAuthTag);
    credentialTitle = cred.title;
  } else {
    if (!input.content?.trim()) throw new Error('Content required');
    plaintext = input.content.trim();
  }

  const token = crypto.randomBytes(32).toString('hex');
  const { iv, ciphertext, authTag } = encrypt(plaintext);
  const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);

  await SecureShare.create({
    token,
    encryptedContent: ciphertext,
    contentIv: iv,
    contentAuthTag: authTag,
    contentType: input.contentType,
    credentialId: input.credentialId,
    credentialTitle,
    recipientEmail: input.recipientEmail,
    createdBy: input.createdBy,
    expiresAt,
    viewLimit: input.viewLimit,
    viewCount: 0,
    destroyed: false,
  });

  const shareUrl = `${env.CLIENT_URL}/secure/${token}`;
  const viewLabel = input.viewLimit === 1 ? 'once' : `${input.viewLimit} times`;
  const what = input.contentType === 'credential'
    ? `a credential (<strong>${credentialTitle}</strong>)`
    : 'a secure note';

  const html = `<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#18181b;padding:20px 28px">
      <span style="color:#fff;font-size:18px;font-weight:600">IT Helpdesk</span>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 12px;font-size:18px;color:#18181b">Secure content shared with you</h2>
      <p style="font-size:14px;color:#3f3f46;margin:0 0 20px">
        <strong>${input.createdByName}</strong> has shared ${what} with you.
      </p>
      <div style="background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#713f12">
        This link can only be viewed <strong>${viewLabel}</strong> and will expire in
        <strong>${expiryLabel(input.expiresInHours)}</strong>. Do not forward this email.
      </div>
      <a href="${shareUrl}" style="display:inline-block;padding:10px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">
        View Secure Content
      </a>
    </div>
    <div style="padding:16px 28px;background:#f4f4f5;font-size:12px;color:#71717a">
      This is an automated message — please do not reply directly to this email.
    </div>
  </div>
</body></html>`;

  await sendMail(
    input.recipientEmail,
    `Secure content shared by ${input.createdByName}`,
    html,
  );

  return { ok: true, expiresAt, viewLimit: input.viewLimit };
}

// ── View ──────────────────────────────────────────────────────────────────────

export type ViewShareResult =
  | { error: 'not_found' | 'destroyed' | 'expired' | 'limit_reached' }
  | {
      content: string;
      contentType: 'credential' | 'note';
      credentialTitle?: string;
      viewsRemaining: number;
      expiresAt: Date;
    };

export async function viewShare(token: string): Promise<ViewShareResult> {
  const share = await SecureShare.findOne({ token });

  if (!share)             return { error: 'not_found' };
  if (share.destroyed)    return { error: 'destroyed' };
  if (share.expiresAt < new Date()) return { error: 'expired' };
  if (share.viewCount >= share.viewLimit) return { error: 'limit_reached' };

  const content = decrypt(share.contentIv, share.encryptedContent, share.contentAuthTag);

  share.viewCount += 1;
  if (share.viewCount >= share.viewLimit) share.destroyed = true;
  await share.save();

  return {
    content,
    contentType: share.contentType,
    credentialTitle: share.credentialTitle,
    viewsRemaining: share.viewLimit - share.viewCount,
    expiresAt: share.expiresAt,
  };
}
