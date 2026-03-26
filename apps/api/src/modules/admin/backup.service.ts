import mongoose from 'mongoose';

// All collections to include in backup/restore
const COLLECTIONS = [
  'users',
  'assets',
  'categories',
  'tickets',
  'credentials',
  'vaultaudits',
  'vendors',
  'networks',
  'racks',
  'rackmounts',
  'locations',
  'articles',
  'docfolders',
  'contacts',
] as const;

export interface BackupManifest {
  version: string;
  exportedAt: string;
  collections: Record<string, unknown[]>;
}

export async function exportBackup(): Promise<BackupManifest> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

  const collections: Record<string, unknown[]> = {};

  for (const name of COLLECTIONS) {
    try {
      const docs = await db.collection(name).find({}).toArray();
      // Serialise ObjectIds and Dates to plain values so JSON.stringify works
      collections[name] = JSON.parse(JSON.stringify(docs));
    } catch {
      collections[name] = [];
    }
  }

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    collections,
  };
}

export async function importBackup(manifest: BackupManifest): Promise<Record<string, number>> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

  if (!manifest?.version || !manifest?.collections) {
    throw new Error('Invalid backup file: missing version or collections');
  }

  const counts: Record<string, number> = {};

  for (const name of COLLECTIONS) {
    const docs = manifest.collections[name];
    if (!Array.isArray(docs)) continue;

    // Restore _id as ObjectId where possible, and convert ISO date strings back to Date objects
    const restored = docs.map((doc: any) => revive(doc));

    const collection = db.collection(name);
    await collection.deleteMany({});

    if (restored.length > 0) {
      await collection.insertMany(restored as any[], { ordered: false });
    }

    counts[name] = restored.length;
  }

  return counts;
}

// Recursively convert _id strings to ObjectIds and ISO strings to Dates
function revive(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    // ISO date string
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
    return value;
  }

  if (Array.isArray(value)) return value.map(revive);

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    // MongoDB Extended JSON: { "$oid": "..." }
    if ('$oid' in obj && typeof obj['$oid'] === 'string') {
      return new mongoose.Types.ObjectId(obj['$oid'] as string);
    }
    // MongoDB Extended JSON: { "$date": "..." } or { "$date": { "$numberLong": "..." } }
    if ('$date' in obj) {
      const d = typeof obj['$date'] === 'string' ? new Date(obj['$date']) : new Date(Number((obj['$date'] as any)?.['$numberLong']));
      if (!isNaN(d.getTime())) return d;
    }

    // Plain _id string that looks like a hex ObjectId
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if ((k === '_id' || k.endsWith('Id') || k === 'credential' || k === 'user' || k === 'createdBy' || k === 'updatedBy') &&
          typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v)) {
        result[k] = new mongoose.Types.ObjectId(v);
      } else {
        result[k] = revive(v);
      }
    }
    return result;
  }

  return value;
}
