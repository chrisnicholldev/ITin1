import { License } from './license.model.js';
import { User } from '../users/user.model.js';
import { sendMail } from '../../lib/mailer.js';
import { env } from '../../config/env.js';

function daysFromNow(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function urgencyColour(days: number) {
  if (days <= 14) return '#dc2626';
  if (days <= 30) return '#d97706';
  return '#2563eb';
}

function urgencyBg(days: number) {
  if (days <= 14) return '#fef2f2';
  if (days <= 30) return '#fffbeb';
  return '#eff6ff';
}

const TYPE_LABELS: Record<string, string> = {
  subscription: 'Subscription',
  perpetual:    'Perpetual',
  oem:          'OEM',
  volume:       'Volume',
  freeware:     'Freeware',
  open_source:  'Open Source',
};

const CYCLE_LABELS: Record<string, string> = {
  monthly:  '/mo',
  annually: '/yr',
  one_time: 'one-time',
};

function licenseRow(lic: {
  id: string; name: string; vendor?: string; licenseType: string;
  seats?: number; cost?: number; billingCycle?: string;
  renewalDate: Date; daysUntil: number;
}) {
  const colour   = urgencyColour(lic.daysUntil);
  const bg       = urgencyBg(lic.daysUntil);
  const daysText = lic.daysUntil <= 0 ? 'Expired' : `${lic.daysUntil}d`;
  const url      = `${env.CLIENT_URL}/licenses`;
  const costStr  = lic.cost !== undefined
    ? `£${lic.cost.toLocaleString()}${lic.billingCycle ? CYCLE_LABELS[lic.billingCycle] ?? '' : ''}`
    : '—';

  return `
    <tr style="border-bottom:1px solid #f4f4f5">
      <td style="padding:10px 12px;font-size:13px">
        <a href="${url}" style="font-weight:500;color:#18181b;text-decoration:none">${lic.name}</a>
        ${lic.vendor ? `<span style="display:block;font-size:11px;color:#71717a">${lic.vendor}</span>` : ''}
      </td>
      <td style="padding:10px 12px;font-size:13px;color:#3f3f46">${TYPE_LABELS[lic.licenseType] ?? lic.licenseType}</td>
      <td style="padding:10px 12px;font-size:13px;color:#3f3f46">${lic.seats !== undefined ? `${lic.seats} seats` : '—'}</td>
      <td style="padding:10px 12px;font-size:13px;color:#3f3f46">${costStr}</td>
      <td style="padding:10px 12px;font-size:13px;color:#3f3f46">${lic.renewalDate.toLocaleDateString()}</td>
      <td style="padding:10px 12px;text-align:right">
        <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${bg};color:${colour}">${daysText}</span>
      </td>
    </tr>`;
}

function section(title: string, colour: string, items: string[]) {
  if (items.length === 0) return '';
  return `
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="width:10px;height:10px;border-radius:50%;background:${colour};display:inline-block"></span>
        <span style="font-size:13px;font-weight:600;color:#18181b;text-transform:uppercase;letter-spacing:.05em">${title} — ${items.length} license${items.length !== 1 ? 's' : ''}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e4e4e7;border-radius:6px;overflow:hidden">
        <thead>
          <tr style="background:#f4f4f5">
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Software</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Type</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Seats</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Cost</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Renewal</th>
            <th style="text-align:right;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Days left</th>
          </tr>
        </thead>
        <tbody>${items.join('')}</tbody>
      </table>
    </div>`;
}

export async function runLicenseAlerts(): Promise<{ sent: number; recipients: number }> {
  const horizon = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const now     = new Date();

  const licenses = await License.find({
    renewalDate: { $exists: true, $ne: null, $lte: horizon },
  }).select('name vendor licenseType seats cost billingCycle renewalDate').lean();

  if (licenses.length === 0) return { sent: 0, recipients: 0 };

  const items = licenses.map((l) => ({
    id:          String(l._id),
    name:        l.name,
    vendor:      l.vendor,
    licenseType: l.licenseType,
    seats:       l.seats,
    cost:        l.cost,
    billingCycle: l.billingCycle,
    renewalDate: l.renewalDate!,
    daysUntil:   daysFromNow(l.renewalDate!),
  })).sort((a, b) => a.daysUntil - b.daysUntil);

  const critical = items.filter((i) => i.daysUntil <= 14);
  const warning  = items.filter((i) => i.daysUntil > 14 && i.daysUntil <= 30);
  const notice   = items.filter((i) => i.daysUntil > 30);

  const admins = await User.find({
    role:  { $in: ['it_admin', 'super_admin'] },
    email: { $exists: true, $ne: '' },
  }).select('email displayName').lean();

  if (admins.length === 0) return { sent: 0, recipients: 0 };

  const html = `<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:700px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#18181b;padding:20px 28px">
      <span style="color:#fff;font-size:18px;font-weight:600">IT Helpdesk</span>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 6px;font-size:18px;color:#18181b">Software license renewal digest</h2>
      <p style="margin:0 0 24px;font-size:13px;color:#71717a">
        ${items.length} license${items.length !== 1 ? 's' : ''} requiring renewal within the next 90 days as of ${now.toLocaleDateString()}.
      </p>
      ${section('Critical — renewing within 14 days', '#dc2626', critical.map(licenseRow))}
      ${section('Warning — renewing within 30 days',  '#d97706', warning.map(licenseRow))}
      ${section('Notice — renewing within 90 days',   '#2563eb', notice.map(licenseRow))}
      <a href="${env.CLIENT_URL}/licenses" style="display:inline-block;padding:10px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">View licenses</a>
    </div>
    <div style="padding:16px 28px;background:#f4f4f5;font-size:12px;color:#71717a">
      This is an automated daily digest. To stop receiving these, remove your admin role or disable SMTP.
    </div>
  </div>
</body></html>`;

  const subject = critical.length > 0
    ? `⚠️ ${critical.length} software license${critical.length !== 1 ? 's' : ''} renewing within 14 days`
    : `Software license renewal digest — ${items.length} license${items.length !== 1 ? 's' : ''} within 90 days`;

  let sent = 0;
  for (const admin of admins) {
    try {
      await sendMail(admin.email, subject, html);
      sent++;
    } catch {
      console.error(`[license-alerts] Failed to send to ${admin.email}`);
    }
  }

  return { sent, recipients: admins.length };
}
