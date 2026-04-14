import { Asset } from './asset.model.js';
import { User } from '../users/user.model.js';
import { sendMail } from '../../lib/mailer.js';
import { env } from '../../config/env.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpiringItem {
  assetId: string;
  assetTag: string;
  name: string;
  type: string;
  expiryType: 'Warranty' | 'License';
  expiresAt: Date;
  daysUntil: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysFromNow(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function urgencyLabel(days: number) {
  if (days <= 7)  return 'critical';
  if (days <= 30) return 'warning';
  return 'notice';
}

function urgencyColour(urgency: string) {
  if (urgency === 'critical') return '#dc2626';
  if (urgency === 'warning')  return '#d97706';
  return '#2563eb';
}

function urgencyBg(urgency: string) {
  if (urgency === 'critical') return '#fef2f2';
  if (urgency === 'warning')  return '#fffbeb';
  return '#eff6ff';
}

function itemRow(item: ExpiringItem) {
  const urgency = urgencyLabel(item.daysUntil);
  const colour  = urgencyColour(urgency);
  const assetUrl = `${env.CLIENT_URL}/assets/${item.assetId}`;
  const daysText = item.daysUntil <= 0 ? 'Expired' : `${item.daysUntil}d`;

  return `
    <tr style="border-bottom:1px solid #f4f4f5">
      <td style="padding:10px 12px;font-size:13px">
        <a href="${assetUrl}" style="font-weight:500;color:#18181b;text-decoration:none">${item.name}</a>
        <span style="display:block;font-size:11px;color:#71717a;font-family:monospace">${item.assetTag}</span>
      </td>
      <td style="padding:10px 12px;font-size:13px;color:#3f3f46;text-transform:capitalize">${item.type.toLowerCase().replace('_', ' ')}</td>
      <td style="padding:10px 12px;font-size:13px;color:#3f3f46">${item.expiryType}</td>
      <td style="padding:10px 12px;font-size:13px;color:#3f3f46">${item.expiresAt.toLocaleDateString()}</td>
      <td style="padding:10px 12px;text-align:right">
        <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${urgencyBg(urgency)};color:${colour}">${daysText}</span>
      </td>
    </tr>`;
}

function section(title: string, colour: string, items: ExpiringItem[]) {
  if (items.length === 0) return '';
  return `
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="width:10px;height:10px;border-radius:50%;background:${colour};display:inline-block"></span>
        <span style="font-size:13px;font-weight:600;color:#18181b;text-transform:uppercase;letter-spacing:.05em">${title} — ${items.length} item${items.length !== 1 ? 's' : ''}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e4e4e7;border-radius:6px;overflow:hidden">
        <thead>
          <tr style="background:#f4f4f5">
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Asset</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Type</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Expiry type</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Date</th>
            <th style="text-align:right;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Days left</th>
          </tr>
        </thead>
        <tbody>${items.map(itemRow).join('')}</tbody>
      </table>
    </div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runAssetAlerts(): Promise<{ sent: number; recipients: number }> {
  const horizon = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const now = new Date();

  // Find assets with warranty or license expiry within 90 days
  const assets = await Asset.find({
    status: { $ne: 'decommissioned' },
    $or: [
      { warrantyExpiry: { $gte: now, $lte: horizon } },
      { 'license.expiryDate': { $gte: now, $lte: horizon } },
    ],
  }).select('assetTag name type warrantyExpiry license').lean();

  if (assets.length === 0) return { sent: 0, recipients: 0 };

  // Build expiring items list
  const items: ExpiringItem[] = [];
  for (const a of assets) {
    if (a.warrantyExpiry) {
      items.push({
        assetId: String(a._id),
        assetTag: a.assetTag,
        name: a.name,
        type: a.type,
        expiryType: 'Warranty',
        expiresAt: a.warrantyExpiry,
        daysUntil: daysFromNow(a.warrantyExpiry),
      });
    }
    if (a.license?.expiryDate) {
      items.push({
        assetId: String(a._id),
        assetTag: a.assetTag,
        name: a.name,
        type: a.type,
        expiryType: 'License',
        expiresAt: a.license.expiryDate,
        daysUntil: daysFromNow(a.license.expiryDate),
      });
    }
  }

  items.sort((a, b) => a.daysUntil - b.daysUntil);

  const critical = items.filter((i) => i.daysUntil <= 7);
  const warning  = items.filter((i) => i.daysUntil > 7 && i.daysUntil <= 30);
  const notice   = items.filter((i) => i.daysUntil > 30);

  // Find all IT admin recipients
  const admins = await User.find({
    role: { $in: ['it_admin', 'super_admin'] },
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
      <h2 style="margin:0 0 6px;font-size:18px;color:#18181b">Asset expiry digest</h2>
      <p style="margin:0 0 24px;font-size:13px;color:#71717a">
        ${items.length} item${items.length !== 1 ? 's' : ''} expiring within the next 90 days as of ${now.toLocaleDateString()}.
      </p>
      ${section('Critical — expiring within 7 days', '#dc2626', critical)}
      ${section('Warning — expiring within 30 days', '#d97706', warning)}
      ${section('Notice — expiring within 90 days', '#2563eb', notice)}
      <a href="${env.CLIENT_URL}/assets" style="display:inline-block;padding:10px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">View all assets</a>
    </div>
    <div style="padding:16px 28px;background:#f4f4f5;font-size:12px;color:#71717a">
      This is an automated daily digest. To stop receiving these, remove your admin role or disable SMTP.
    </div>
  </div>
</body></html>`;

  const subject = critical.length > 0
    ? `⚠️ ${critical.length} asset${critical.length !== 1 ? 's' : ''} expiring within 7 days`
    : `Asset expiry digest — ${items.length} item${items.length !== 1 ? 's' : ''} within 90 days`;

  let sent = 0;
  for (const admin of admins) {
    try {
      await sendMail(admin.email, subject, html);
      sent++;
    } catch {
      console.error(`[asset-alerts] Failed to send to ${admin.email}`);
    }
  }

  return { sent, recipients: admins.length };
}
