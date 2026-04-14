import mongoose from 'mongoose';
import { IpAddress, type IIpAddressDocument } from './ip-address.model.js';
import { Network } from './network.model.js';
import { AppError } from '../../middleware/error.middleware.js';

// ── CIDR utilities ─────────────────────────────────────────────────────────────

function ipToNum(ip: string): number {
  return ip.split('.').reduce((acc, oct) => ((acc << 8) | parseInt(oct)) >>> 0, 0) >>> 0;
}

function numToIp(num: number): string {
  return [(num >>> 24) & 0xff, (num >>> 16) & 0xff, (num >>> 8) & 0xff, num & 0xff].join('.');
}

function parseCidr(cidr: string) {
  const [ip, prefStr] = cidr.split('/');
  const prefix = parseInt(prefStr ?? '32');
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const networkNum = (ipToNum(ip) & mask) >>> 0;
  const broadcastNum = (networkNum | (~mask >>> 0)) >>> 0;
  const size = broadcastNum - networkNum + 1;
  return { networkNum, broadcastNum, prefix, size, mask };
}

// ── Response helpers ──────────────────────────────────────────────────────────

function toResponse(doc: IIpAddressDocument) {
  const obj = doc.toObject({ virtuals: true }) as Record<string, any>;
  const asset = obj['assetId'];
  return {
    id:        doc.id as string,
    networkId: String(doc.networkId),
    address:   doc.address,
    label:     doc.label,
    type:      doc.type,
    asset:     asset?._id ? { id: String(asset._id), name: asset.name, assetTag: asset.assetTag } : undefined,
    notes:     doc.notes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export async function getIpamForNetwork(networkId: string) {
  const network = await Network.findById(networkId).lean();
  if (!network) throw new AppError(404, 'Network not found');

  const cidr = parseCidr(network.address);
  const assignments = await IpAddress.find({ networkId: new mongoose.Types.ObjectId(networkId) })
    .populate('assetId', 'name assetTag')
    .sort({ address: 1 }) as IIpAddressDocument[];

  const assignedMap = new Map(assignments.map((a) => [a.address, a]));

  // Build full IP grid for subnets up to /22 (1024 addresses)
  const canVisualise = cidr.size <= 1024;
  let grid: Array<{ ip: string; type: 'network' | 'broadcast' | 'gateway' | 'static' | 'reserved' | 'dhcp' | 'free'; label?: string; assetName?: string }> = [];

  if (canVisualise) {
    const gatewayIp = (network as any).gateway ?? '';
    for (let i = cidr.networkNum; i <= cidr.broadcastNum; i++) {
      const ip = numToIp(i);
      if (i === cidr.networkNum) {
        grid.push({ ip, type: 'network', label: 'Network address' });
      } else if (i === cidr.broadcastNum) {
        grid.push({ ip, type: 'broadcast', label: 'Broadcast' });
      } else if (ip === gatewayIp) {
        grid.push({ ip, type: 'gateway', label: 'Gateway' });
      } else if (assignedMap.has(ip)) {
        const a = assignedMap.get(ip)!;
        const assetObj = (a as any).assetId;
        grid.push({ ip, type: a.type, label: a.label, assetName: assetObj?.name });
      } else {
        grid.push({ ip, type: 'free' });
      }
    }
  }

  const usedCount = assignments.length;
  // Network + broadcast are not usable
  const usableTotal = Math.max(0, cidr.size - 2);

  return {
    network: {
      id:          String(network._id),
      name:        network.name,
      address:     network.address,
      gateway:     (network as any).gateway,
      vlanId:      network.vlanId,
      dhcpEnabled: network.dhcpEnabled,
      dhcpRange:   network.dhcpRange,
    },
    subnet: {
      networkAddress:   numToIp(cidr.networkNum),
      broadcastAddress: numToIp(cidr.broadcastNum),
      prefix:           cidr.prefix,
      totalAddresses:   cidr.size,
      usableAddresses:  usableTotal,
      usedAddresses:    usedCount,
      freeAddresses:    usableTotal - usedCount,
    },
    canVisualise,
    grid,
    assignments: assignments.map(toResponse),
  };
}

export async function assignIp(
  networkId: string,
  input: { address: string; label: string; type?: 'static' | 'reserved' | 'dhcp'; assetId?: string; notes?: string },
) {
  const network = await Network.findById(networkId).lean();
  if (!network) throw new AppError(404, 'Network not found');

  // Validate IP is within subnet
  const cidr = parseCidr(network.address);
  const ipNum = ipToNum(input.address);
  if (ipNum <= cidr.networkNum || ipNum >= cidr.broadcastNum) {
    throw new AppError(400, 'IP address is outside the usable range of this subnet');
  }

  const doc = await IpAddress.create({
    networkId:  new mongoose.Types.ObjectId(networkId),
    address:    input.address,
    label:      input.label,
    type:       input.type ?? 'static',
    assetId:    input.assetId ? new mongoose.Types.ObjectId(input.assetId) : undefined,
    notes:      input.notes,
  }) as IIpAddressDocument;

  await doc.populate('assetId', 'name assetTag');
  return toResponse(doc);
}

export async function updateIpAssignment(
  id: string,
  input: { label?: string; type?: 'static' | 'reserved' | 'dhcp'; assetId?: string | null; notes?: string },
) {
  const updates: Record<string, unknown> = {};
  if (input.label !== undefined) updates['label'] = input.label;
  if (input.type  !== undefined) updates['type']  = input.type;
  if (input.notes !== undefined) updates['notes'] = input.notes;
  if (input.assetId !== undefined) {
    updates['assetId'] = input.assetId ? new mongoose.Types.ObjectId(input.assetId) : null;
  }

  const doc = await IpAddress.findByIdAndUpdate(id, { $set: updates }, { new: true })
    .populate('assetId', 'name assetTag') as IIpAddressDocument | null;
  if (!doc) throw new AppError(404, 'IP assignment not found');
  return toResponse(doc);
}

export async function releaseIp(id: string) {
  const doc = await IpAddress.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, 'IP assignment not found');
}
