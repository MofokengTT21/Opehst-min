import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from './index';

// We'll implement the actual push/pull logic later, this is just the skeleton
export async function sync() {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
      // Implement pull logic here
      // E.g. fetch('/api/sync?last_pulled_at=' + lastPulledAt)
      return {
        changes: {},
        timestamp: Date.now(),
      };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      // Implement push logic here
      // E.g. fetch('/api/sync', { method: 'POST', body: JSON.stringify({ changes }) })
    },
    migrationsEnabledAtVersion: 1,
  });
}

export async function applySyncChanges(changes: any) {
  try {
    await database.write(async () => {
      for (const table of Object.keys(changes)) {
        let collection;
        try {
          collection = database.collections.get(table as any);
        } catch (e) {
          console.warn(`Collection for table ${table} not found, skipping.`);
          continue;
        }

        const { created = [], updated = [], deleted = [] } = changes[table] || {};

        // 1. Process Created
        for (const rawRecord of created) {
          try {
            // Check if record already exists
            const existing = await collection.find(rawRecord.id);
            // If exists, update it to avoid duplicate key error
            await existing.update((record: any) => {
              Object.assign(record._raw, rawRecord);
            });
          } catch {
            // Does not exist, create it
            await collection.create((record: any) => {
              Object.assign(record._raw, rawRecord);
            });
          }
        }

        // 2. Process Updated
        for (const rawRecord of updated) {
          try {
            const existing = await collection.find(rawRecord.id);
            await existing.update((record: any) => {
              Object.assign(record._raw, rawRecord);
            });
          } catch {
            // Fallback: if not found, create it
            await collection.create((record: any) => {
              Object.assign(record._raw, rawRecord);
            });
          }
        }

        // 3. Process Deleted
        for (const id of deleted) {
          try {
            const existing = await collection.find(id);
            await existing.destroyPermanently();
          } catch {
            // Ignore if already deleted
          }
        }
      }
    });
    console.log('Successfully applied sync changes to database');
  } catch (err) {
    console.error('Failed to apply sync changes:', err);
  }
}

