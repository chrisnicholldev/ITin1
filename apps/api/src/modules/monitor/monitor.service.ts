import { exec } from 'child_process';
import { promisify } from 'util';
import { Asset } from '../assets/asset.model.js';
import { MonitorCheck, MonitorState } from './monitor.model.js';
import { sendMail } from '../../lib/mailer.js';
import { User } from '../users/user.model.js';
import { UserRole } from '@itdesk/shared';

const execAsync = promisify(exec);

// Only allow valid IPv4 addresses through exec to prevent injection
function isValidIpv4(ip: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
    ip.split('.').every((n) => parseInt(n, 10) <= 255);
}

function getAssetIp(asset: { specs?: { ipAddress?: string }; network?: { ipAddress?: string } }): string | null {
  return asset.network?.ipAddress?.trim() ?? asset.specs?.ipAddress?.trim() ?? null;
}

async function pingHost(ip: string): Promise<{ alive: boolean; latencyMs: number | null }> {
  if (!isValidIpv4(ip)) return { alive: false, latencyMs: null };
  try {
    const { stdout } = await execAsync(`ping -c 1 -W 2 ${ip}`, { timeout: 5000 });
    const match = stdout.match(/time[=<](\d+\.?\d*)\s*ms/i);
    return { alive: true, latencyMs: match?.[1] != null ? Math.round(parseFloat(match[1])) : null };
  } catch {
    return { alive: false, latencyMs: null };
  }
}

// Concurrency-limited batch runner
async function pMap<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency = 10): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = await Promise.all(items.slice(i, i + concurrency).map(fn));
    results.push(...batch);
  }
  return results;
}

export async function runPingChecks(): Promise<{ checked: number; up: number; down: number }> {
  const assets = await Asset.find({ monitored: true, status: { $ne: 'decommissioned' } }).lean();

  const pingable = assets.filter((a) => {
    const ip = getAssetIp(a as any);
    return ip && isValidIpv4(ip);
  });

  let up = 0;
  let down = 0;

  await pMap(pingable, async (asset) => {
    const ip = getAssetIp(asset as any)!;
    const { alive, latencyMs } = await pingHost(ip);
    const now = new Date();
    const status: 'up' | 'down' = alive ? 'up' : 'down';

    if (alive) up++; else down++;

    // Save to time-series
    await MonitorCheck.create({ assetId: asset._id, status, latencyMs, checkedAt: now });

    // Upsert current state and detect transitions
    const prev = await MonitorState.findOne({ assetId: asset._id });
    const prevStatus = prev?.currentStatus ?? 'unknown';

    await MonitorState.findOneAndUpdate(
      { assetId: asset._id },
      {
        $set: {
          currentStatus: status,
          lastCheckedAt: now,
          lastLatencyMs: latencyMs,
          ...(prevStatus !== status ? { statusChangedAt: now } : {}),
        },
      },
      { upsert: true, new: true },
    );

    // Send down alert (once per outage — don't re-alert if already notified while still down)
    if (status === 'down' && prevStatus !== 'down') {
      await sendDownAlert(asset as any, ip, now);
    }

    // Send recovery alert
    if (status === 'up' && prevStatus === 'down') {
      await sendRecoveryAlert(asset as any, ip);
    }
  });

  return { checked: pingable.length, up, down };
}

async function getAdminEmails(): Promise<string[]> {
  const admins = await User.find({
    role: { $in: [UserRole.IT_ADMIN, UserRole.SUPER_ADMIN] },
    isActive: true,
  }).lean();
  return admins.map((u) => u.email).filter(Boolean);
}

async function sendDownAlert(asset: { _id: unknown; name: string; assetTag: string }, ip: string, now: Date): Promise<void> {
  const emails = await getAdminEmails();
  if (!emails.length) return;

  await MonitorState.findOneAndUpdate(
    { assetId: asset._id },
    { $set: { downAlertSentAt: now } },
  );

  const subject = `[ITin1 Alert] ${asset.name} is DOWN`;
  const html = `<p><strong>${asset.name}</strong> (${asset.assetTag}, ${ip}) is not responding to ping checks.</p>
<p>Outage started: ${now.toLocaleString()}</p>
<p>You will receive a recovery notification when the device comes back online.</p>`;

  for (const email of emails) {
    await sendMail(email, subject, html).catch(() => {});
  }
}

async function sendRecoveryAlert(asset: { name: string; assetTag: string }, ip: string): Promise<void> {
  const emails = await getAdminEmails();
  if (!emails.length) return;

  const subject = `[ITin1 Recovery] ${asset.name} is back UP`;
  const html = `<p><strong>${asset.name}</strong> (${asset.assetTag}, ${ip}) is responding to ping again.</p>
<p>Recovered: ${new Date().toLocaleString()}</p>`;

  for (const email of emails) {
    await sendMail(email, subject, html).catch(() => {});
  }
}

export async function getMonitorStatus() {
  const assets = await Asset.find({ monitored: true, status: { $ne: 'decommissioned' } })
    .select('name assetTag type specs.ipAddress network.ipAddress monitored')
    .lean();

  const assetIds = assets.map((a) => a._id);
  const states = await MonitorState.find({ assetId: { $in: assetIds } }).lean();
  const stateMap = new Map(states.map((s) => [s.assetId.toString(), s]));

  // Uptime % over last 24h per asset
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const history = await MonitorCheck.aggregate([
    { $match: { assetId: { $in: assetIds }, checkedAt: { $gte: since24h } } },
    { $group: { _id: '$assetId', total: { $sum: 1 }, up: { $sum: { $cond: [{ $eq: ['$status', 'up'] }, 1, 0] } } } },
  ]);
  const uptimeMap = new Map(history.map((h) => [h._id.toString(), Math.round((h.up / h.total) * 100)]));

  return assets.map((asset) => {
    const state = stateMap.get((asset._id as any).toString());
    return {
      assetId: (asset._id as any).toString(),
      name: asset.name,
      assetTag: asset.assetTag,
      type: asset.type,
      ip: getAssetIp(asset as any),
      status: state?.currentStatus ?? 'unknown',
      lastCheckedAt: state?.lastCheckedAt ?? null,
      lastLatencyMs: state?.lastLatencyMs ?? null,
      statusChangedAt: state?.statusChangedAt ?? null,
      uptime24h: uptimeMap.get((asset._id as any).toString()) ?? null,
    };
  });
}

export async function toggleMonitored(assetId: string, monitored: boolean): Promise<void> {
  await Asset.findByIdAndUpdate(assetId, { $set: { monitored } });
  if (!monitored) {
    // Clean up state when monitoring is disabled
    await MonitorState.deleteOne({ assetId });
  }
}
