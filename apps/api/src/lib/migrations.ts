import mongoose from 'mongoose';

/**
 * Drop the old non-sparse unique index on contacts.azureId.
 *
 * The original schema created `azureId_1` as unique without sparse, so every
 * manual contact (azureId absent) collides on null after the first one.
 * The schema now declares sparse:true — dropping the stale index lets Mongoose
 * rebuild it correctly on next autoIndex/syncIndexes pass.
 */
async function migrateContactAzureIdIndex(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  // Skip on a fresh database where the collection has not been created yet —
  // listing indexes on a missing namespace throws NamespaceNotFound (code 26).
  const exists = await db.listCollections({ name: 'contacts' }).hasNext();
  if (!exists) return;

  const collection = db.collection('contacts');
  const indexes = await collection.indexes();
  const staleIndex = indexes.find(
    (idx) => idx.key?.azureId === 1 && idx.unique === true && !idx.sparse,
  );

  if (staleIndex) {
    const name = staleIndex.name as string;
    await collection.dropIndex(name);
    console.log(`[migrations] Dropped stale non-sparse index "${name}" from contacts`);
  }
}

export async function runMigrations(): Promise<void> {
  await migrateContactAzureIdIndex();
}
