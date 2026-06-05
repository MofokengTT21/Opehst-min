/**
 * sync.ts — WatermelonDB native synchronize() implementation.
 *
 * This replaces ALL the old custom array-looping fetch functions
 * (fetchAdminDeltaSync, fetchHubs, fetchChannels, etc.) for organisational
 * structure. The native synchronize() engine:
 *   - Only transfers records changed since the last pull (true delta sync)
 *   - Processes all DB writes in the native SQLite layer (no JS thread blocking)
 *   - Handles created / updated / DELETED records natively
 *   - Stores the `lastPulledAt` timestamp between sessions
 */

import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from '../database';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const API_BASE = 'http://192.168.1.102:3000/api';
const TOKEN_KEY = 'opehst_access_token';
const LAST_PULLED_KEY = 'opehst_last_pulled_at';

// ─── Storage helpers (web-safe, mirrors the pattern in auth.ts) ──────────────

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function getLastPulledAt(): Promise<number> {
  try {
    if (Platform.OS === 'web') {
      const v = localStorage.getItem(LAST_PULLED_KEY);
      return v ? Number(v) : 0;
    }
    const v = await SecureStore.getItemAsync(LAST_PULLED_KEY);
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

async function saveLastPulledAt(ts: number): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(LAST_PULLED_KEY, String(ts));
      return;
    }
    await SecureStore.setItemAsync(LAST_PULLED_KEY, String(ts));
  } catch {
    // Non-fatal: will just re-pull slightly more data next time.
    console.warn('[Sync] Could not persist lastPulledAt');
  }
}

// ─── Main sync function ───────────────────────────────────────────────────────

export async function syncDatabase(): Promise<boolean> {
  try {
    const token = await getToken();
    if (!token) {
      console.warn('[Sync] No auth token — skipping sync');
      return false;
    }

    const lastPulledAt = await getLastPulledAt();

    await synchronize({
      database,

      // pullChanges: Fetch only records changed since lastPulledAt.
      // The server returns the WatermelonDB SyncPullResult contract:
      // { changes: { table: { created, updated, deleted } }, timestamp }
      pullChanges: async ({ lastPulledAt: wmlLastPulled }) => {
        // Use the persisted value (handles first-launch edge cases where
        // WatermelonDB passes null on a fresh database).
        const since = wmlLastPulled ?? lastPulledAt;

        const url = `${API_BASE}/sync/pull${since ? `?lastPulledAt=${since}` : ''}`;

        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? `Sync pull failed: ${response.status}`);
        }

        const { changes, timestamp } = await response.json();

        // Persist the server timestamp for the next invocation.
        await saveLastPulledAt(timestamp);

        return { changes, timestamp };
      },

      // pushChanges: Handles offline-first mutations. Sends the local SQLite
      // changes to the server so they can be persisted to PostgreSQL.
      pushChanges: async ({ changes, lastPulledAt }) => {
        const url = `${API_BASE}/sync/push`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ changes, lastPulledAt }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? `Sync push failed: ${response.status}`);
        }
      },
    });

    console.log('[Sync] Pull complete ✓');
    return true;
  } catch (err) {
    console.error('[Sync] Sync error:', err);
    return false;
  }
}

/**
 * Clears the persisted lastPulledAt timestamp so the next syncDatabase()
 * call will perform a full pull (useful after logout).
 */
export async function clearSyncState(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(LAST_PULLED_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(LAST_PULLED_KEY);
  } catch {
    // Ignore
  }
}
