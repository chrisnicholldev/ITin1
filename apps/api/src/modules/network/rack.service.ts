import mongoose from 'mongoose';
import { Rack, RackMount, type IRackDocument, type IRackMountDocument } from './rack.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type { CreateRackInput, UpdateRackInput, CreateRackMountInput } from '@itdesk/shared';

function mountToResponse(m: IRackMountDocument) {
  const obj = m.toObject({ virtuals: true }) as Record<string, any>;
  const asset = obj['asset'];
  return {
    id: m.id as string,
    asset: asset?._id ? {
      id: String(asset._id),
      name: asset.name,
      assetTag: asset.assetTag,
      type: asset.type,
      status: asset.status,
      manufacturer: asset.manufacturer,
      modelName: asset.modelName,
      specs: asset.specs,
      network: asset.network,
    } : undefined,
    label: m.label,
    startU: m.startU,
    endU: m.endU,
    face: (m.face ?? 'both') as 'front' | 'back' | 'both',
    notes: m.notes,
  };
}

async function getMountsForRack(rackId: string) {
  const mounts = await RackMount.find({ rack: new mongoose.Types.ObjectId(rackId) })
    .populate('asset', 'name assetTag type status manufacturer modelName specs network')
    .sort({ startU: 1 }) as IRackMountDocument[];
  return mounts.map(mountToResponse);
}

function rackToResponse(rack: IRackDocument, mounts: ReturnType<typeof mountToResponse>[]) {
  return {
    id: rack.id as string,
    name: rack.name,
    location: rack.location,
    totalU: rack.totalU,
    uNumbering: (rack.uNumbering ?? 'top-down') as 'top-down' | 'bottom-up',
    notes: rack.notes,
    mounts,
    createdAt: rack.createdAt.toISOString(),
    updatedAt: rack.updatedAt.toISOString(),
  };
}

export async function listRacks() {
  const racks = await Rack.find().sort({ location: 1, name: 1 }) as IRackDocument[];
  // Get mount counts for summary
  const mountCounts = await RackMount.aggregate([
    { $group: { _id: '$rack', count: { $sum: 1 }, usedU: { $sum: { $add: [{ $subtract: ['$endU', '$startU'] }, 1] } } } },
  ]);
  const countMap = new Map(mountCounts.map((m) => [String(m._id), { count: m.count, usedU: m.usedU }]));

  return racks.map((r) => ({
    id: r.id as string,
    name: r.name,
    location: r.location,
    totalU: r.totalU,
    notes: r.notes,
    mountCount: countMap.get(r.id as string)?.count ?? 0,
    usedU: countMap.get(r.id as string)?.usedU ?? 0,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getRack(id: string) {
  const rack = await Rack.findById(id) as IRackDocument | null;
  if (!rack) throw new AppError(404, 'Rack not found');
  const mounts = await getMountsForRack(id);
  return rackToResponse(rack, mounts);
}

export async function createRack(input: CreateRackInput) {
  const rack = await Rack.create(input) as IRackDocument;
  return rackToResponse(rack, []);
}

export async function updateRack(id: string, input: UpdateRackInput) {
  const rack = await Rack.findByIdAndUpdate(id, { $set: input }, { new: true }) as IRackDocument | null;
  if (!rack) throw new AppError(404, 'Rack not found');
  const mounts = await getMountsForRack(id);
  return rackToResponse(rack, mounts);
}

export async function deleteRack(id: string) {
  const rack = await Rack.findById(id);
  if (!rack) throw new AppError(404, 'Rack not found');
  await RackMount.deleteMany({ rack: new mongoose.Types.ObjectId(id) });
  await Rack.findByIdAndDelete(id);
}

export async function addMount(rackId: string, input: CreateRackMountInput) {
  const rack = await Rack.findById(rackId) as IRackDocument | null;
  if (!rack) throw new AppError(404, 'Rack not found');

  if (input.startU < 1 || input.endU > rack.totalU) {
    throw new AppError(400, `U positions must be between 1 and ${rack.totalU}`);
  }

  // Check for overlapping mounts — only conflict if they share a face
  const face = input.face ?? 'both';
  const facesConflict = (a: string, b: string) =>
    a === 'both' || b === 'both' || a === b;

  const candidates = await RackMount.find({
    rack: new mongoose.Types.ObjectId(rackId),
    startU: { $lte: input.endU },
    endU: { $gte: input.startU },
  });
  const overlap = candidates.find((c) => facesConflict(face, c.face ?? 'both'));
  if (overlap) {
    throw new AppError(409, `U${input.startU}–U${input.endU} (${face}) overlaps with an existing mount`);
  }

  const mount = await RackMount.create({
    rack: new mongoose.Types.ObjectId(rackId),
    asset: input.assetId ? new mongoose.Types.ObjectId(input.assetId) : undefined,
    label: input.label,
    startU: input.startU,
    endU: input.endU,
    face,
    notes: input.notes,
  }) as IRackMountDocument;

  await mount.populate('asset', 'name assetTag type status manufacturer modelName specs network');
  return mountToResponse(mount);
}

export async function updateMount(rackId: string, mountId: string, input: Partial<CreateRackMountInput>) {
  const mount = await RackMount.findOne({
    _id: new mongoose.Types.ObjectId(mountId),
    rack: new mongoose.Types.ObjectId(rackId),
  }) as IRackMountDocument | null;
  if (!mount) throw new AppError(404, 'Mount not found');

  const newStart = input.startU ?? mount.startU;
  const newEnd = input.endU ?? mount.endU;

  const rack = await Rack.findById(rackId) as IRackDocument | null;
  if (!rack) throw new AppError(404, 'Rack not found');

  if (newStart < 1 || newEnd > rack.totalU) {
    throw new AppError(400, `U positions must be between 1 and ${rack.totalU}`);
  }

  // Check overlaps (excluding this mount), face-aware
  const newFace = input.face ?? mount.face ?? 'both';
  const facesConflict = (a: string, b: string) =>
    a === 'both' || b === 'both' || a === b;

  const candidates = await RackMount.find({
    rack: new mongoose.Types.ObjectId(rackId),
    _id: { $ne: new mongoose.Types.ObjectId(mountId) },
    startU: { $lte: newEnd },
    endU: { $gte: newStart },
  });
  const overlap = candidates.find((c) => facesConflict(newFace, c.face ?? 'both'));
  if (overlap) {
    throw new AppError(409, `U${newStart}–U${newEnd} (${newFace}) overlaps with an existing mount`);
  }

  const updates: Record<string, unknown> = {};
  if (input.startU !== undefined) updates['startU'] = input.startU;
  if (input.endU !== undefined) updates['endU'] = input.endU;
  if (input.face !== undefined) updates['face'] = input.face;
  if (input.label !== undefined) updates['label'] = input.label;
  if (input.notes !== undefined) updates['notes'] = input.notes;

  const updated = await RackMount.findByIdAndUpdate(mountId, { $set: updates }, { new: true })
    .populate('asset', 'name assetTag type status manufacturer modelName specs network') as IRackMountDocument | null;
  if (!updated) throw new AppError(404, 'Mount not found');
  return mountToResponse(updated);
}

export async function getMountsByAsset(assetId: string) {
  const mounts = await RackMount.find({ asset: new mongoose.Types.ObjectId(assetId) })
    .populate('rack', 'name location totalU') as IRackMountDocument[];

  return mounts.map((m) => {
    const obj = m.toObject({ virtuals: true }) as Record<string, any>;
    const rack = obj['rack'];
    return {
      mountId: m.id as string,
      startU: m.startU,
      endU: m.endU,
      rack: rack ? { id: String(rack._id), name: rack.name, location: rack.location } : null,
    };
  });
}

export async function removeMount(rackId: string, mountId: string) {
  const result = await RackMount.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(mountId),
    rack: new mongoose.Types.ObjectId(rackId),
  });
  if (!result) throw new AppError(404, 'Mount not found');
}
