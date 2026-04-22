import { exec } from 'child_process';
import { promisify } from 'util';
import { Asset } from '../assets/asset.model.js';
import { IpAddress } from '../network/ip-address.model.js';
import { Network } from '../network/network.model.js';
import { MonitorCheck, MonitorState } from './monitor.model.js';
import { sendMail } from '../../lib/mailer.js';
import { User } from '../users/user.model.js';
import { UserRole } from '@itdesk/shared';
import mongoose from 'mongoose';

const execAsync = promisify(exec);

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

async function pMap<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency = 10): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = await Promise.all(items.slice(i, i + concurrency).map(fn));
    results.push(...batch);
  }
  return results;
}

type PingTarget = {
  sourceType: 'asset' | 'ipam';
  sourceId: mongoose.Types.ObjectId;
  ip: string;
  name: string;
  assetTag?: string;
};

export async function runPingChecks(): Promise<{ checked: number; up: number; down: number }> {
  // Gather asset targets
  const assets = await Asset.find({ monitored: true, status: { $ne: 'decommissioned' } }).lean();
  const assetTargets: PingTarget[] = assets
    .map((a) => ({ sourceType: 'asset' as const, sourceId: a._id as mongoose.Types.ObjectId, ip: getAssetIp(a as any) ?? '', name: a.name, assetTag: a.assetTag }))
    .filter((t) => t.ip && isValidIpv4(t.ip));

  // Gather IPAM targets
  const ipEntries = await IpAddress.find({ monitored: true }).lean();
  const ipamTargets: PingTarget[] = ipEntries
    .map((e) => ({ sourceType: 'ipam' as const, sourceId: e._id as mongoose.Types.ObjectId, ip: e.address, name: e.label }))
    .filter((t) => t.ip && isValidIpv4(t.ip));

  const targets = [...assetTargets, ...ipamTargets];
  let up = 0;
  let down = 0;

  await pMap(targets, async (target) => {
    const { alive, latencyMs } = await pingHost(target.ip);
    const now = new Date();
    const status: 'up' | 'down' = alive ? 'up' : 'down';

    if (alive) up++; else down++;

    await MonitorCheck.create({ sourceType: target.sourceType, sourceId: target.sourceId, status, latencyMs, checkedAt: now });

    const prev = await MonitorState.findOne({ sourceType: target.sourceType, sourceId: target.sourceId });
    const prevStatus = prev?.currentStatus ?? 'unknown';

    await MonitorState.findOneAndUpdate(
      { sourceType: target.sourceType, sourceId: target.sourceId },
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

    if (status === 'down' && prevStatus !== 'down') {
      await sendDownAlert(target, now);
    }
    if (status === 'up' && prevStatus === 'down') {
      await sendRecoveryAlert(target);
    }
  });

  return { checked: targets.length, up, down };
}

async function getAdminEmails(): Promise<string[]> {
  const admins = await User.find({ role: { $in: [UserRole.IT_ADMIN, UserRole.SUPER_ADMIN] }, isActive: true }).lean();
  return admins.map((u) => u.email).filter(Boolean);
}

async function sendDownAlert(target: PingTarget, now: Date): Promise<void> {
  const emails = await getAdminEmails();
  if (!emails.length) return;

  await MonitorState.findOneAndUpdate(
    { sourceType: target.sourceType, sourceId: target.sourceId },
    { $set: { downAlertSentAt: now } },
  );

  const label = target.assetTag ? `${target.name} (${target.assetTag})` : target.name;
  const subject = `[ITin1 Alert] ${target.name} is DOWN`;
  const html = `<p><strong>${label}</strong> (${target.ip}) is not responding to ping checks.</p>
<p>Outage started: ${now.toLocaleString()}</p>
<p>You will receive a recovery notification when the device comes back online.</p>`;

  for (const email of emails) await sendMail(email, subject, html).catch(() => {});
}

async function sendRecoveryAlert(target: PingTarget): Promise<void> {
  const emails = await getAdminEmails();
  if (!emails.length) return;

  const label = target.assetTag ? `${target.name} (${target.assetTag})` : target.name;
  const subject = `[ITin1 Recovery] ${target.name} is back UP`;
  const html = `<p><strong>${label}</strong> (${target.ip}) is responding to ping again.</p>
<p>Recovered: ${new Date().toLocaleString()}</p>`;

  for (const email of emails) await sendMail(email, subject, html).catch(() => {});
}

export async function getMonitorStatus() {
  // Assets
  const assets = await Asset.find({ monitored: true, status: { $ne: 'decommissioned' } })
    .select('name assetTag type specs.ipAddress network.ipAddress')
    .lean();

  // IPAM entries
  const ipEntries = await IpAddress.find({ monitored: true })
    .populate('networkId', 'name')
    .lean();

  const allSources = [
    ...assets.map((a) => ({
      sourceType: 'asset' as const,
      sourceId: (a._id as any).toString(),
      name: a.name,
      assetTag: a.assetTag,
      type: a.type,
      ip: getAssetIp(a as any),
      networkId: null as string | null,
      networkName: null as string | null,
    })),
    ...ipEntries.map((e) => ({
      sourceType: 'ipam' as const,
      sourceId: (e._id as any).toString(),
      name: e.label,
      assetTag: undefined,
      type: 'ipam',
      ip: e.address,
      networkId: (e.networkId as any)?._id ? String((e.networkId as any)._id) : null,
      networkName: (e.networkId as any)?.name ?? null,
    })),
  ];

  const sourceIds = allSources.map((s) => new mongoose.Types.ObjectId(s.sourceId));

  const states = await MonitorState.find({ sourceId: { $in: sourceIds } }).lean();
  const stateMap = new Map(states.map((s) => [`${s.sourceType}:${s.sourceId.toString()}`, s]));

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const history = await MonitorCheck.aggregate([
    { $match: { sourceId: { $in: sourceIds }, checkedAt: { $gte: since24h } } },
    { $group: { _id: { sourceType: '$sourceType', sourceId: '$sourceId' }, total: { $sum: 1 }, up: { $sum: { $cond: [{ $eq: ['$status', 'up'] }, 1, 0] } } } },
  ]);
  const uptimeMap = new Map(history.map((h) => [`${h._id.sourceType}:${h._id.sourceId.toString()}`, Math.round((h.up / h.total) * 100)]));

  return allSources.map((src) => {
    const key = `${src.sourceType}:${src.sourceId}`;
    const state = stateMap.get(key);
    return {
      sourceId: src.sourceId,
      sourceType: src.sourceType,
      name: src.name,
      assetTag: src.assetTag ?? null,
      type: src.type,
      ip: src.ip,
      networkId: src.networkId,
      networkName: src.networkName,
      status: (state?.currentStatus ?? 'unknown') as 'up' | 'down' | 'unknown',
      lastCheckedAt: state?.lastCheckedAt ?? null,
      lastLatencyMs: state?.lastLatencyMs ?? null,
      statusChangedAt: state?.statusChangedAt ?? null,
      uptime24h: uptimeMap.get(key) ?? null,
    };
  });
}

export async function toggleMonitored(assetId: string, monitored: boolean): Promise<void> {
  await Asset.findByIdAndUpdate(assetId, { $set: { monitored } });
  if (!monitored) {
    await MonitorState.deleteOne({ sourceType: 'asset', sourceId: new mongoose.Types.ObjectId(assetId) });
  }
}

export async function toggleIpMonitored(ipAddressId: string, monitored: boolean): Promise<void> {
  await IpAddress.findByIdAndUpdate(ipAddressId, { $set: { monitored } });
  if (!monitored) {
    await MonitorState.deleteOne({ sourceType: 'ipam', sourceId: new mongoose.Types.ObjectId(ipAddressId) });
  }
}
