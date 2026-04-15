import { License, type ILicenseDocument } from './license.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type { CreateLicenseInput, UpdateLicenseInput, LicenseStatus } from '@itdesk/shared';

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveStatus(renewalDate: Date | undefined, licenseType: string): LicenseStatus {
  if (!renewalDate) return 'no_expiry';
  const daysLeft = Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 0) return 'expired';
  if (daysLeft <= 90) return 'expiring_soon';
  return 'active';
}

function toResponse(doc: ILicenseDocument) {
  return {
    id:           doc.id as string,
    name:         doc.name,
    vendor:       doc.vendor,
    licenseType:  doc.licenseType,
    seats:        doc.seats,
    cost:         doc.cost,
    billingCycle: doc.billingCycle,
    purchasedAt:  doc.purchasedAt?.toISOString(),
    renewalDate:  doc.renewalDate?.toISOString(),
    licenseKey:   doc.licenseKey,
    assignedTo:   doc.assignedTo,
    notes:        doc.notes,
    tags:         doc.tags ?? [],
    status:       deriveStatus(doc.renewalDate, doc.licenseType),
    createdAt:    doc.createdAt.toISOString(),
    updatedAt:    doc.updatedAt.toISOString(),
  };
}

function parseDateField(value: string | undefined): Date | undefined {
  if (!value || value === '') return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

// ── Service functions ─────────────────────────────────────────────────────────

export async function listLicenses(query: {
  status?: string;
  licenseType?: string;
  search?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (query.licenseType) filter['licenseType'] = query.licenseType;
  if (query.search) {
    const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter['$or'] = [{ name: re }, { vendor: re }, { assignedTo: re }, { tags: re }];
  }

  const docs = await License.find(filter).sort({ name: 1 }) as ILicenseDocument[];
  const responses = docs.map(toResponse);

  // Filter by derived status after mapping (can't do this in Mongo easily)
  if (query.status) return responses.filter((r) => r.status === query.status);
  return responses;
}

export async function getLicense(id: string) {
  const doc = await License.findById(id) as ILicenseDocument | null;
  if (!doc) throw new AppError(404, 'License not found');
  return toResponse(doc);
}

export async function createLicense(input: CreateLicenseInput) {
  const doc = await License.create({
    name:         input.name,
    vendor:       input.vendor,
    licenseType:  input.licenseType,
    seats:        input.seats,
    cost:         input.cost,
    billingCycle: input.billingCycle,
    purchasedAt:  parseDateField(input.purchasedAt),
    renewalDate:  parseDateField(input.renewalDate),
    licenseKey:   input.licenseKey,
    assignedTo:   input.assignedTo,
    notes:        input.notes,
    tags:         input.tags ?? [],
  }) as ILicenseDocument;
  return toResponse(doc);
}

export async function updateLicense(id: string, input: UpdateLicenseInput) {
  const updates: Record<string, unknown> = {};
  if (input.name         !== undefined) updates['name']         = input.name;
  if (input.vendor       !== undefined) updates['vendor']       = input.vendor;
  if (input.licenseType  !== undefined) updates['licenseType']  = input.licenseType;
  if (input.seats        !== undefined) updates['seats']        = input.seats;
  if (input.cost         !== undefined) updates['cost']         = input.cost;
  if (input.billingCycle !== undefined) updates['billingCycle'] = input.billingCycle;
  if (input.purchasedAt  !== undefined) updates['purchasedAt']  = parseDateField(input.purchasedAt);
  if (input.renewalDate  !== undefined) updates['renewalDate']  = parseDateField(input.renewalDate);
  if (input.licenseKey   !== undefined) updates['licenseKey']   = input.licenseKey;
  if (input.assignedTo   !== undefined) updates['assignedTo']   = input.assignedTo;
  if (input.notes        !== undefined) updates['notes']        = input.notes;
  if (input.tags         !== undefined) updates['tags']         = input.tags;

  const doc = await License.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }) as ILicenseDocument | null;
  if (!doc) throw new AppError(404, 'License not found');
  return toResponse(doc);
}

export async function deleteLicense(id: string) {
  const doc = await License.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, 'License not found');
}
