import mongoose from 'mongoose';
import { Asset, type IAssetDocument } from './asset.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import { CreateAssetSchema, type CreateAssetInput, type UpdateAssetInput } from '@itdesk/shared';
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
    monitored: asset.monitored ?? false,
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

export async function importAssets(rows: Record<string, string>[]) {
  let imported = 0;
  const errors: { row: number; name: string; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2; // 1-indexed + header row
    const name = row['name'] ?? '';

    const parsed = CreateAssetSchema.safeParse({
      name,
      type: row['type']?.toLowerCase().replace(' ', '_') || 'other',
      status: row['status']?.toLowerCase().replace(' ', '_') || 'active',
      location: row['location'] || undefined,
      manufacturer: row['manufacturer'] || undefined,
      modelName: row['model'] || row['modelname'] || undefined,
      serialNumber: row['serialnumber'] || row['serial'] || undefined,
      purchaseDate: row['purchasedate'] || row['purchase_date'] || undefined,
      warrantyExpiry: row['warrantyexpiry'] || row['warranty_expiry'] || row['warranty'] || undefined,
      purchaseCost: row['purchasecost'] || row['purchase_cost'] || row['cost'] || undefined,
      notes: row['notes'] || undefined,
      specs: {
        cpu: row['cpu'] || undefined,
        ram: row['ram'] || undefined,
        storage: row['storage'] || undefined,
        os: row['os'] || undefined,
        ipAddress: row['ipaddress'] || row['ip'] || undefined,
        macAddress: row['macaddress'] || row['mac'] || undefined,
      },
      license: {
        key: row['licensekey'] || row['license_key'] || undefined,
        seats: row['licenseseats'] || row['license_seats'] || undefined,
        vendor: row['licensevendor'] || row['license_vendor'] || undefined,
        expiryDate: row['licenseexpiry'] || row['license_expiry'] || undefined,
      },
      customFields: {},
    });

    if (!parsed.success) {
      const reason = Object.values(parsed.error.flatten().fieldErrors).flat().join(', ');
      errors.push({ row: rowNum, name: name || `Row ${rowNum}`, reason });
      continue;
    }

    try {
      await createAsset(parsed.data);
      imported++;
    } catch (err: any) {
      errors.push({ row: rowNum, name: name || `Row ${rowNum}`, reason: err.message ?? 'Unknown error' });
    }
  }

  return { imported, skipped: rows.length - imported - errors.length, errors };
}

export async function getSummary() {
  const [byType, byStatus] = await Promise.all([
    Asset.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
    Asset.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return { byType, byStatus };
}
