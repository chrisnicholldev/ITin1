import { SslCert } from './ssl-cert.model.js';
import { User } from '../users/user.model.js';
import { sendMail } from '../../lib/mailer.js';
import { env } from '../../config/env.js';

function daysFromNow(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function urgencyColour(days: number) {
  if (days <= 7)  return '#dc2626';
  if (days <= 30) return '#d97706';
  return '#2563eb';
}

function urgencyBg(days: number) {
  if (days <= 7)  return '#fef2f2';
  if (days <= 30) return '#fffbeb';
  return '#eff6ff';
}

function certRow(cert: { id: string; domain: string; commonName?: string; issuer?: string; expiresAt: Date; daysUntil: number }) {
  const colour  = urgencyColour(cert.daysUntil);
  const bg      = urgencyBg(cert.daysUntil);
  const daysText = cert.daysUntil <= 0 ? 'Expired' : `${cert.daysUntil}d`;
  const certUrl  = `${env.CLIENT_URL}/ssl-certs`;

  return `
    <tr style="border-bottom:1px solid #f4f4f5">
      <td style="padding:10px 12px;font-size:13px">
        <a href="${certUrl}" style="font-weight:500;color:#18181b;text-decoration:none">${cert.domain}</a>
        ${cert.commonName && cert.commonName !== cert.domain ? `<span style="display:block;font-size:11px;color:#71717a">${cert.commonName}</span>` : ''}
      </td>
      <td style="padding:10px 12px;font-size:13px;color:#3f3f46">${cert.issuer ?? '—'}</td>
      <td style="padding:10px 12px;font-size:13px;color:#3f3f46">${cert.expiresAt.toLocaleDateString()}</td>
      <td style="padding:10px 12px;text-align:right">
        <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${bg};color:${colour}">${daysText}</span>
      </td>
    </tr>`;
}

function section(title: string, colour: string, items: ReturnType<typeof certRow>[]) {
  if (items.length === 0) return '';
  return `
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="width:10px;height:10px;border-radius:50%;background:${colour};display:inline-block"></span>
        <span style="font-size:13px;font-weight:600;color:#18181b;text-transform:uppercase;letter-spacing:.05em">${title} — ${items.length} cert${items.length !== 1 ? 's' : ''}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e4e4e7;border-radius:6px;overflow:hidden">
        <thead>
          <tr style="background:#f4f4f5">
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Domain</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Issuer</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Expires</th>
            <th style="text-align:right;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Days left</th>
          </tr>
        </thead>
        <tbody>${items.join('')}</tbody>
      </table>
    </div>`;
}

export async function runSslCertAlerts(): Promise<{ sent: number; recipients: number }> {
  const horizon = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const now     = new Date();

  const certs = await SslCert.find({
    expiresAt: { $gte: now, $lte: horizon },
    status:    { $ne: 'error' },
  }).select('domain commonName issuer expiresAt').lean();

  if (certs.length === 0) return { sent: 0, recipients: 0 };

  const items = certs.map((c) => ({
    id:         String(c._id),
    domain:     c.domain,
    commonName: c.commonName,
    issuer:     c.issuer,
    expiresAt:  c.expiresAt!,
    daysUntil:  daysFromNow(c.expiresAt!),
  })).sort((a, b) => a.daysUntil - b.daysUntil);

  const critical = items.filter((i) => i.daysUntil <= 7);
  const warning  = items.filter((i) => i.daysUntil > 7  && i.daysUntil <= 30);
  const notice   = items.filter((i) => i.daysUntil > 30);

  const admins = await User.find({
    role:  { $in: ['it_admin', 'super_admin'] },
    email: { $exists: true, $ne: '' },
  }).select('email displayName').lean();

  if (admins.length === 0) return { sent: 0, recipients: 0 };

  const html = `<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:660px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#18181b;padding:20px 28px">
      <span style="color:#fff;font-size:18px;font-weight:600">IT Helpdesk</span>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 6px;font-size:18px;color:#18181b">SSL certificate expiry digest</h2>
      <p style="margin:0 0 24px;font-size:13px;color:#71717a">
        ${items.length} certificate${items.length !== 1 ? 's' : ''} expiring within the next 90 days as of ${now.toLocaleDateString()}.
      </p>
      ${section('Critical — expiring within 7 days',  '#dc2626', critical.map(certRow))}
      ${section('Warning — expiring within 30 days',  '#d97706', warning.map(certRow))}
      ${section('Notice — expiring within 90 days',   '#2563eb', notice.map(certRow))}
      <a href="${env.CLIENT_URL}/ssl-certs" style="display:inline-block;padding:10px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">View SSL certificates</a>
    </div>
    <div style="padding:16px 28px;background:#f4f4f5;font-size:12px;color:#71717a">
      This is an automated daily digest. To stop receiving these, remove your admin role or disable SMTP.
    </div>
  </div>
</body></html>`;

  const subject = critical.length > 0
    ? `⚠️ ${critical.length} SSL cert${critical.length !== 1 ? 's' : ''} expiring within 7 days`
    : `SSL cert expiry digest — ${items.length} cert${items.length !== 1 ? 's' : ''} within 90 days`;

  let sent = 0;
  for (const admin of admins) {
    try {
      await sendMail(admin.email, subject, html);
      sent++;
    } catch {
      console.error(`[ssl-cert-alerts] Failed to send to ${admin.email}`);
    }
  }

  return { sent, recipients: admins.length };
}
