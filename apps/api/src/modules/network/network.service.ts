import mongoose from 'mongoose';
import { Network, type INetworkDocument } from './network.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type { CreateNetworkInput, UpdateNetworkInput } from '@itdesk/shared';

function toResponse(doc: INetworkDocument) {
  const obj = doc.toObject({ virtuals: true }) as Record<string, any>;
  const loc = obj['location'];
  return {
    id: doc.id as string,
    name: doc.name,
    address: doc.address,
    vlanId: doc.vlanId,
    gateway: doc.gateway,
    dnsServers: doc.dnsServers,
    dhcpEnabled: doc.dhcpEnabled,
    dhcpRange: doc.dhcpRange,
    location: loc?._id ? { id: String(loc._id), name: loc.name } : undefined,
    description: doc.description,
    notes: doc.notes,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listNetworks(locationId?: string) {
  const filter: Record<string, any> = {};
  if (locationId) filter['location'] = new mongoose.Types.ObjectId(locationId);
  const docs = await Network.find(filter)
    .populate('location', 'name')
    .sort({ name: 1 }) as INetworkDocument[];
  return docs.map(toResponse);
}

export async function getNetwork(id: string) {
  const doc = await Network.findById(id).populate('location', 'name') as INetworkDocument | null;
  if (!doc) throw new AppError(404, 'Network not found');
  return toResponse(doc);
}

export async function createNetwork(input: CreateNetworkInput) {
  const doc = await Network.create({
    ...input,
    location: input.locationId ? new mongoose.Types.ObjectId(input.locationId) : undefined,
  }) as INetworkDocument;
  await doc.populate('location', 'name');
  return toResponse(doc);
}

export async function updateNetwork(id: string, input: UpdateNetworkInput) {
  const update: Record<string, any> = { ...input };
  if ('locationId' in input) {
    update['location'] = input.locationId ? new mongoose.Types.ObjectId(input.locationId) : null;
    delete update['locationId'];
  }
  const doc = await Network.findByIdAndUpdate(id, { $set: update }, { new: true })
    .populate('location', 'name') as INetworkDocument | null;
  if (!doc) throw new AppError(404, 'Network not found');
  return toResponse(doc);
}

export async function deleteNetwork(id: string) {
  const doc = await Network.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, 'Network not found');
}
