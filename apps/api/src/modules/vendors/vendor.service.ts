import mongoose from 'mongoose';
import { Vendor, type IVendorDocument } from './vendor.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type { CreateVendorInput, UpdateVendorInput, VendorContactInput } from '@itdesk/shared';

function toResponse(doc: IVendorDocument) {
  return {
    id: doc.id as string,
    name: doc.name,
    type: doc.type,
    website: doc.website,
    supportPhone: doc.supportPhone,
    supportEmail: doc.supportEmail,
    accountNumber: doc.accountNumber,
    notes: doc.notes,
    contacts: doc.contacts.map((c) => ({
      id: String(c._id),
      name: c.name,
      title: c.title,
      phone: c.phone,
      email: c.email,
      notes: c.notes,
      isPrimary: c.isPrimary,
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listVendors() {
  const docs = await Vendor.find().sort({ name: 1 }) as IVendorDocument[];
  return docs.map(toResponse);
}

export async function getVendor(id: string) {
  const doc = await Vendor.findById(id) as IVendorDocument | null;
  if (!doc) throw new AppError(404, 'Vendor not found');
  return toResponse(doc);
}

export async function createVendor(input: CreateVendorInput) {
  const doc = await Vendor.create({ ...input, contacts: [] }) as IVendorDocument;
  return toResponse(doc);
}

export async function updateVendor(id: string, input: UpdateVendorInput) {
  const doc = await Vendor.findByIdAndUpdate(id, { $set: input }, { new: true }) as IVendorDocument | null;
  if (!doc) throw new AppError(404, 'Vendor not found');
  return toResponse(doc);
}

export async function deleteVendor(id: string) {
  const doc = await Vendor.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, 'Vendor not found');
}

export async function addContact(vendorId: string, input: VendorContactInput) {
  const doc = await Vendor.findById(vendorId) as IVendorDocument | null;
  if (!doc) throw new AppError(404, 'Vendor not found');
  doc.contacts.push({
    _id: new mongoose.Types.ObjectId(),
    name: input.name,
    title: input.title,
    phone: input.phone,
    email: input.email,
    notes: input.notes,
    isPrimary: input.isPrimary ?? false,
  });
  await doc.save();
  return toResponse(doc);
}

export async function updateContact(vendorId: string, contactId: string, input: Partial<VendorContactInput>) {
  const doc = await Vendor.findById(vendorId) as IVendorDocument | null;
  if (!doc) throw new AppError(404, 'Vendor not found');
  const contact = doc.contacts.find((c) => String(c._id) === contactId);
  if (!contact) throw new AppError(404, 'Contact not found');
  Object.assign(contact, input);
  await doc.save();
  return toResponse(doc);
}

export async function deleteContact(vendorId: string, contactId: string) {
  const doc = await Vendor.findById(vendorId) as IVendorDocument | null;
  if (!doc) throw new AppError(404, 'Vendor not found');
  const idx = doc.contacts.findIndex((c) => String(c._id) === contactId);
  if (idx === -1) throw new AppError(404, 'Contact not found');
  doc.contacts.splice(idx, 1);
  await doc.save();
  return toResponse(doc);
}
