import mongoose from 'mongoose';
import { Contract, type IContractDocument } from './contract.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type { CreateContractInput, UpdateContractInput, ContractStatus } from '@itdesk/shared';

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveStatus(endDate: Date | undefined): ContractStatus {
  if (!endDate) return 'no_expiry';
  const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 0) return 'expired';
  if (daysLeft <= 90) return 'expiring_soon';
  return 'active';
}

function noticeDueDate(endDate: Date | undefined, noticePeriodDays: number | undefined): Date | undefined {
  if (!endDate || !noticePeriodDays) return undefined;
  return new Date(endDate.getTime() - noticePeriodDays * 24 * 60 * 60 * 1000);
}

function parseDateField(value: string | undefined): Date | undefined {
  if (!value || value === '') return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

function toResponse(doc: IContractDocument) {
  const obj = doc.toObject({ virtuals: true });
  const nd   = noticeDueDate(doc.endDate, doc.noticePeriodDays);
  return {
    id:               doc.id as string,
    name:             doc.name,
    contractType:     doc.contractType,
    vendor:           obj.vendor
      ? { id: obj.vendor._id?.toString() ?? obj.vendor.id, name: obj.vendor.name }
      : undefined,
    vendorName:       doc.vendorName,
    asset:            obj.asset
      ? { id: obj.asset._id?.toString() ?? obj.asset.id, name: obj.asset.name, assetTag: obj.asset.assetTag }
      : undefined,
    contractNumber:   doc.contractNumber,
    value:            doc.value,
    startDate:        doc.startDate?.toISOString(),
    endDate:          doc.endDate?.toISOString(),
    autoRenews:       doc.autoRenews,
    noticePeriodDays: doc.noticePeriodDays,
    noticeDueDate:    nd?.toISOString(),
    contactName:      doc.contactName,
    contactEmail:     doc.contactEmail,
    documentUrl:      doc.documentUrl,
    notes:            doc.notes,
    tags:             doc.tags ?? [],
    status:           deriveStatus(doc.endDate),
    createdAt:        doc.createdAt.toISOString(),
    updatedAt:        doc.updatedAt.toISOString(),
  };
}

// ── Service functions ─────────────────────────────────────────────────────────

export async function listContracts(query: {
  status?: string;
  contractType?: string;
  search?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (query.contractType) filter['contractType'] = query.contractType;
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter['$or'] = [{ name: re }, { vendorName: re }, { contractNumber: re }, { contactName: re }, { tags: re }];
  }

  const docs = await Contract.find(filter)
    .populate('vendor', 'name')
    .populate('asset', 'name assetTag')
    .sort({ endDate: 1, name: 1 }) as IContractDocument[];

  const responses = docs.map(toResponse);
  if (query.status) return responses.filter((r) => r.status === query.status);
  return responses;
}

export async function getContract(id: string) {
  const doc = await Contract.findById(id)
    .populate('vendor', 'name')
    .populate('asset', 'name assetTag') as IContractDocument | null;
  if (!doc) throw new AppError(404, 'Contract not found');
  return toResponse(doc);
}

export async function createContract(input: CreateContractInput) {
  const doc = await Contract.create({
    name:             input.name,
    contractType:     input.contractType,
    vendor:           input.vendorId ? new mongoose.Types.ObjectId(input.vendorId) : undefined,
    vendorName:       input.vendorName,
    asset:            input.assetId ? new mongoose.Types.ObjectId(input.assetId) : undefined,
    contractNumber:   input.contractNumber,
    value:            input.value,
    startDate:        parseDateField(input.startDate),
    endDate:          parseDateField(input.endDate),
    autoRenews:       input.autoRenews ?? false,
    noticePeriodDays: input.noticePeriodDays,
    contactName:      input.contactName,
    contactEmail:     input.contactEmail,
    documentUrl:      input.documentUrl,
    notes:            input.notes,
    tags:             input.tags ?? [],
  }) as IContractDocument;
  return getContract(String(doc._id));
}

export async function updateContract(id: string, input: UpdateContractInput) {
  const updates: Record<string, unknown> = {};
  if (input.name             !== undefined) updates['name']             = input.name;
  if (input.contractType     !== undefined) updates['contractType']     = input.contractType;
  if (input.vendorId         !== undefined) updates['vendor']           = input.vendorId ? new mongoose.Types.ObjectId(input.vendorId) : null;
  if (input.vendorName       !== undefined) updates['vendorName']       = input.vendorName;
  if (input.assetId          !== undefined) updates['asset']            = input.assetId ? new mongoose.Types.ObjectId(input.assetId) : null;
  if (input.contractNumber   !== undefined) updates['contractNumber']   = input.contractNumber;
  if (input.value            !== undefined) updates['value']            = input.value;
  if (input.startDate        !== undefined) updates['startDate']        = parseDateField(input.startDate);
  if (input.endDate          !== undefined) updates['endDate']          = parseDateField(input.endDate);
  if (input.autoRenews       !== undefined) updates['autoRenews']       = input.autoRenews;
  if (input.noticePeriodDays !== undefined) updates['noticePeriodDays'] = input.noticePeriodDays;
  if (input.contactName      !== undefined) updates['contactName']      = input.contactName;
  if (input.contactEmail     !== undefined) updates['contactEmail']     = input.contactEmail;
  if (input.documentUrl      !== undefined) updates['documentUrl']      = input.documentUrl;
  if (input.notes            !== undefined) updates['notes']            = input.notes;
  if (input.tags             !== undefined) updates['tags']             = input.tags;

  const doc = await Contract.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true })
    .populate('vendor', 'name')
    .populate('asset', 'name assetTag') as IContractDocument | null;
  if (!doc) throw new AppError(404, 'Contract not found');
  return toResponse(doc);
}

export async function deleteContract(id: string) {
  const doc = await Contract.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, 'Contract not found');
}

// ── Renewals summary (used by the combined renewals page) ─────────────────────

export async function getUpcomingRenewals(days = 90) {
  const horizon = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const docs = await Contract.find({
    endDate: { $exists: true, $ne: null, $lte: horizon },
  })
    .populate('vendor', 'name')
    .populate('asset', 'name assetTag')
    .sort({ endDate: 1 }) as IContractDocument[];
  return docs.map(toResponse);
}
