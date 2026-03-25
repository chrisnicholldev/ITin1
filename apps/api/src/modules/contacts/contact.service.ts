import { Contact, type IContactDocument } from './contact.model.js';

export function toContactResponse(c: IContactDocument) {
  return {
    id: c.id,
    azureId: c.azureId,
    displayName: c.displayName,
    email: c.email,
    upn: c.upn,
    department: c.department,
    jobTitle: c.jobTitle,
    accountEnabled: c.accountEnabled,
    lastSyncedAt: c.lastSyncedAt,
  };
}

export async function searchContacts(search: string, limit = 20) {
  const filter = search
    ? { $text: { $search: search } }
    : {};
  const contacts = await Contact.find(filter).limit(limit).lean();
  return contacts.map((c) => ({
    id: c._id,
    azureId: c.azureId,
    displayName: c.displayName,
    email: c.email,
    upn: c.upn,
    department: c.department,
    jobTitle: c.jobTitle,
  }));
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
