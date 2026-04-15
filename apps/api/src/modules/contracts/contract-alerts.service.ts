import { Contract } from './contract.model.js';
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
  vendor_contract: 'Vendor contract',
  warranty:        'Warranty',
  maintenance:     'Maintenance',
  support:         'Support',
  insurance:       'Insurance',
  lease:           'Lease',
  other:           'Other',
};

function contractRow(c: {
  name: string; contractType: string; vendorName?: string;
  endDate: Date; daysUntil: number; noticePeriodDays?: number; noticeDueDate?: Date;
  autoRenews: boolean;
}) {
  const colour   = urgencyColour(c.daysUntil);
  const bg       = urgencyBg(c.daysUntil);
  const daysText = c.daysUntil <= 0 ? 'Expired' : `${c.daysUntil}d`;
  const url      = `${env.CLIENT_URL}/contracts`;

  const noticeNote = c.noticeDueDate
    ? `<span style="display:block;font-size:11px;color:#dc2626">Notice by ${c.noticeDueDate.toLocaleDateString()}</span>`
    : '';
  const autoRenewNote = c.autoRenews
    ? `<span style="display:block;font-size:11px;color:#71717a">Auto-renews</span>`
    : '';

  return `
    <tr style="border-bottom:1px solid #f4f4f5">
      <td style="padding:10px 12px;font-size:13px">
        <a href="${url}" style="font-weight:500;color:#18181b;text-decoration:none">${c.name}</a>
        ${c.vendorName ? `<span style="display:block;font-size:11px;color:#71717a">${c.vendorName}</span>` : ''}
        ${noticeNote}${autoRenewNote}
      </td>
      <td style="padding:10px 12px;font-size:13px;color:#3f3f46">${TYPE_LABELS[c.contractType] ?? c.contractType}</td>
      <td style="padding:10px 12px;font-size:13px;color:#3f3f46">${c.endDate.toLocaleDateString()}</td>
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
        <span style="font-size:13px;font-weight:600;color:#18181b;text-transform:uppercase;letter-spacing:.05em">${title} — ${items.length} contract${items.length !== 1 ? 's' : ''}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e4e4e7;border-radius:6px;overflow:hidden">
        <thead>
          <tr style="background:#f4f4f5">
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Contract</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Type</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">End date</th>
            <th style="text-align:right;padding:8px 12px;font-size:11px;color:#71717a;font-weight:500">Days left</th>
          </tr>
        </thead>
        <tbody>${items.join('')}</tbody>
      </table>
    </div>`;
}

export async function runContractAlerts(): Promise<{ sent: number; recipients: number }> {
  const horizon = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const now     = new Date();

  const contracts = await Contract.find({
    endDate: { $exists: true, $ne: null, $lte: horizon },
  }).select('name contractType vendorName endDate autoRenews noticePeriodDays').lean();

  if (contracts.length === 0) return { sent: 0, recipients: 0 };

  const items = contracts
    .filter((c): c is typeof c & { endDate: Date } => c.endDate instanceof Date)
    .map((c) => {
      const daysUntil = daysFromNow(c.endDate);
      const nd = c.noticePeriodDays
        ? new Date(c.endDate.getTime() - c.noticePeriodDays * 24 * 60 * 60 * 1000)
        : undefined;
      return {
        name:             c.name,
        contractType:     c.contractType,
        vendorName:       c.vendorName,
        endDate:          c.endDate,
        autoRenews:       c.autoRenews,
        noticePeriodDays: c.noticePeriodDays,
        noticeDueDate:    nd,
        daysUntil,
      };
    }).sort((a, b) => a.daysUntil - b.daysUntil);

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
  <div style="max-width:660px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#18181b;padding:20px 28px">
      <span style="color:#fff;font-size:18px;font-weight:600">IT Helpdesk</span>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 6px;font-size:18px;color:#18181b">Contract &amp; warranty renewal digest</h2>
      <p style="margin:0 0 24px;font-size:13px;color:#71717a">
        ${items.length} contract${items.length !== 1 ? 's' : ''} expiring within the next 90 days as of ${now.toLocaleDateString()}.
      </p>
      ${section('Critical — expiring within 14 days', '#dc2626', critical.map(contractRow))}
      ${section('Warning — expiring within 30 days',  '#d97706', warning.map(contractRow))}
      ${section('Notice — expiring within 90 days',   '#2563eb', notice.map(contractRow))}
      <a href="${env.CLIENT_URL}/contracts" style="display:inline-block;padding:10px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">View contracts</a>
    </div>
    <div style="padding:16px 28px;background:#f4f4f5;font-size:12px;color:#71717a">
      This is an automated daily digest. To stop receiving these, remove your admin role or disable SMTP.
    </div>
  </div>
</body></html>`;

  const subject = critical.length > 0
    ? `⚠️ ${critical.length} contract${critical.length !== 1 ? 's' : ''} expiring within 14 days`
    : `Contract renewal digest — ${items.length} contract${items.length !== 1 ? 's' : ''} within 90 days`;

  let sent = 0;
  for (const admin of admins) {
    try {
      await sendMail(admin.email, subject, html);
      sent++;
    } catch {
      console.error(`[contract-alerts] Failed to send to ${admin.email}`);
    }
  }

  return { sent, recipients: admins.length };
}
