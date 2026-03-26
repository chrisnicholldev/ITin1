import mongoose from 'mongoose';
import { Asset, type IAssetDocument } from './asset.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type { CreateAssetInput, UpdateAssetInput } from '@itdesk/shared';
import { z } from 'zod';

function toResponse(asset: IAssetDocument) {
  const obj = asset.toObject({ virtuals: true }) as Record<string, any>;
  const networkDoc = obj['networkId'];
  const vendorDoc = obj['vendorId'];
  return {
    id: asset.id,
    assetTag: asset.assetTag,
    name: asset.name,
    type: asset.type,
    status: asset.status,
    assignedTo: asset.assignedTo,
    assignedContact: asset.assignedContact,
    location: asset.location,
    manufacturer: asset.manufacturer,
    modelName: asset.modelName,
    serialNumber: asset.serialNumber,
    purchaseDate: asset.purchaseDate,
    warrantyExpiry: asset.warrantyExpiry,
    purchaseCost: asset.purchaseCost,
    specs: asset.specs,
    license: asset.license,
    network: asset.network,
    linkedNetwork: networkDoc?._id
      ? { id: String(networkDoc._id), name: networkDoc.name, address: networkDoc.address, vlanId: networkDoc.vlanId }
      : undefined,
    vendor: vendorDoc?._id
      ? {
          id: String(vendorDoc._id),
          name: vendorDoc.name,
          type: vendorDoc.type,
          supportPhone: vendorDoc.supportPhone,
          supportEmail: vendorDoc.supportEmail,
          contacts: (vendorDoc.contacts ?? []).map((c: any) => ({
            id: String(c._id),
            name: c.name,
            title: c.title,
            phone: c.phone,
            email: c.email,
            isPrimary: c.isPrimary,
          })),
        }
      : undefined,
    notes: asset.notes,
    externalSource: asset.externalSource,
    externalId: asset.externalId,
    lastSyncedAt: asset.lastSyncedAt,
    customFields: asset.customFields,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(25),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  type: z.string().optional(),
  status: z.string().optional(),
  assignedTo: z.string().optional(),
  networkId: z.string().optional(),
  externalSource: z.string().optional(),
  search: z.string().optional(),
});

export async function listAssets(rawQuery: unknown) {
  const query = ListQuerySchema.parse(rawQuery);
  const filter: Record<string, unknown> = {};

  if (query.type) filter['type'] = query.type;
  if (query.status) filter['status'] = query.status;
  if (query.assignedTo) filter['assignedTo'] = new mongoose.Types.ObjectId(query.assignedTo);
  if (query.networkId) filter['networkId'] = new mongoose.Types.ObjectId(query.networkId);
  if (query.externalSource === 'manual') {
    filter['externalSource'] = { $exists: false };
  } else if (query.externalSource) {
    filter['externalSource'] = query.externalSource;
  }
  if (query.search) {
    filter['$or'] = [
      { name: { $regex: query.search, $options: 'i' } },
      { assetTag: { $regex: query.search, $options: 'i' } },
      { serialNumber: { $regex: query.search, $options: 'i' } },
      { manufacturer: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    Asset.find(filter)
      .populate('assignedTo', 'displayName email')
      .populate('assignedContact', 'displayName email upn department jobTitle')
      .populate('networkId', 'name address vlanId')
      .populate('vendorId', 'name type supportPhone supportEmail contacts')
      .sort({ [query.sort]: query.order === 'asc' ? 1 : -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit) as Promise<IAssetDocument[]>,
    Asset.countDocuments(filter),
  ]);

  return {
    data: data.map(toResponse),
    meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getAsset(id: string) {
  const asset = await Asset.findById(id)
    .populate('assignedTo', 'displayName email')
    .populate('assignedContact', 'displayName email upn department jobTitle')
    .populate('networkId', 'name address vlanId')
    .populate('vendorId', 'name type supportPhone supportEmail contacts') as IAssetDocument | null;
  if (!asset) throw new AppError(404, 'Asset not found');
  return toResponse(asset);
}

export async function createAsset(input: CreateAssetInput) {
  const count = await Asset.countDocuments();
  const assetTag = `ASSET-${String(count + 1).padStart(4, '0')}`;
  const doc: Record<string, unknown> = {
    ...input,
    assetTag,
    assignedTo: input.assignedTo ? new mongoose.Types.ObjectId(input.assignedTo) : undefined,
    networkId: (input as any).networkId ? new mongoose.Types.ObjectId((input as any).networkId) : undefined,
  };
  const asset = await Asset.create(doc) as IAssetDocument;
  await asset.populate('networkId', 'name address vlanId');
  return toResponse(asset);
}

export async function updateAsset(id: string, input: UpdateAssetInput) {
  const updates: Record<string, unknown> = { ...input };
  if (input.assignedTo !== undefined) {
    updates['assignedTo'] = input.assignedTo ? new mongoose.Types.ObjectId(input.assignedTo) : null;
  }
  if ((input as any).networkId !== undefined) {
    updates['networkId'] = (input as any).networkId ? new mongoose.Types.ObjectId((input as any).networkId) : null;
  }
  if ((input as any).vendorId !== undefined) {
    updates['vendorId'] = (input as any).vendorId ? new mongoose.Types.ObjectId((input as any).vendorId) : null;
  }

  const asset = await Asset.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true })
    .populate('assignedTo', 'displayName email')
    .populate('networkId', 'name address vlanId')
    .populate('vendorId', 'name type supportPhone supportEmail contacts') as IAssetDocument | null;

  if (!asset) throw new AppError(404, 'Asset not found');
  return toResponse(asset);
}

export async function deactivateAsset(id: string) {
  const asset = await Asset.findByIdAndUpdate(
    id,
    { $set: { status: 'decommissioned' } },
    { new: true },
  ) as IAssetDocument | null;
  if (!asset) throw new AppError(404, 'Asset not found');
  return toResponse(asset);
}

export async function getSummary() {
  const [byType, byStatus] = await Promise.all([
    Asset.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
    Asset.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return { byType, byStatus };
}
