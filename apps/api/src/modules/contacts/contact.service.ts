import { Contact, CONTACT_SOURCE, type IContactDocument } from './contact.model.js';
import { AppError } from '../../middleware/error.middleware.js';

export function toContactResponse(c: IContactDocument) {
  return {
    id: c.id as string,
    source: c.source,
    displayName: c.displayName,
    email: c.email,
    phone: c.phone,
    company: c.company,
    jobTitle: c.jobTitle,
    department: c.department,
    notes: c.notes,
    // Azure AD fields
    azureId: c.azureId,
    upn: c.upn,
    accountEnabled: c.accountEnabled,
    lastSyncedAt: c.lastSyncedAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export async function listContacts(search?: string, limit = 50) {
  const filter = search ? { $text: { $search: search } } : {};
  const contacts = await Contact.find(filter)
    .sort({ displayName: 1 })
    .limit(limit)
    .lean();
  return contacts.map((c) => ({
    id: String(c._id),
    source: c.source,
    displayName: c.displayName,
    email: c.email,
    phone: c.phone,
    company: c.company,
    jobTitle: c.jobTitle,
    department: c.department,
    notes: c.notes,
    azureId: c.azureId,
    upn: c.upn,
    accountEnabled: c.accountEnabled,
    lastSyncedAt: c.lastSyncedAt,
  }));
}

export async function createManualContact(input: {
  displayName: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  department?: string;
  notes?: string;
}) {
  const doc = await Contact.create({ ...input, source: CONTACT_SOURCE.MANUAL });
  return toContactResponse(doc);
}

export async function updateManualContact(id: string, input: {
  displayName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  department?: string;
  notes?: string;
}) {
  const doc = await Contact.findById(id);
  if (!doc) throw new AppError(404, 'Contact not found');
  if (doc.source !== CONTACT_SOURCE.MANUAL) throw new AppError(403, 'Azure AD contacts cannot be edited manually');

  const updates: Record<string, unknown> = {};
  if (input.displayName !== undefined) updates['displayName'] = input.displayName;
  if (input.email !== undefined) updates['email'] = input.email;
  if (input.phone !== undefined) updates['phone'] = input.phone;
  if (input.company !== undefined) updates['company'] = input.company;
  if (input.jobTitle !== undefined) updates['jobTitle'] = input.jobTitle;
  if (input.department !== undefined) updates['department'] = input.department;
  if (input.notes !== undefined) updates['notes'] = input.notes;

  const updated = await Contact.findByIdAndUpdate(id, { $set: updates }, { new: true });
  return toContactResponse(updated!);
}

export async function deleteManualContact(id: string) {
  const doc = await Contact.findById(id);
  if (!doc) throw new AppError(404, 'Contact not found');
  if (doc.source !== CONTACT_SOURCE.MANUAL) throw new AppError(403, 'Azure AD contacts cannot be deleted manually');
  await Contact.findByIdAndDelete(id);
}

export async function findContactByUpn(upn: string): Promise<IContactDocument | null> {
  return Contact.findOne({ upn });
}

// Bulk upsert — called during Azure AD sync
export async function upsertContacts(users: Array<{
  azureId: string;
  displayName: string;
  email?: string;
  upn: string;
  department?: string;
  jobTitle?: string;
  accountEnabled: boolean;
}>) {
  const ops = users.map((u) => ({
    updateOne: {
      filter: { azureId: u.azureId },
      update: {
        $set: {
          ...u,
          source: CONTACT_SOURCE.AZURE_AD,
          lastSyncedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  const result = await Contact.bulkWrite(ops, { ordered: false });
  return {
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
  };
}
