import { getDatabase } from './schema';

interface SyncMetaRow {
  value: string;
}

export function getSyncMeta(key: string): string | null {
  const db = getDatabase();
  const row = db.getFirstSync<SyncMetaRow>('SELECT value FROM sync_meta WHERE key = ?', [key]);
  return row ? row.value : null;
}

export function setSyncMeta(key: string, value: string): void {
  const db = getDatabase();
  db.runSync('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)', [key, value]);
}

const EPOCH = new Date(0).toISOString();

export function getSyncWatermark(key: string): string {
  return getSyncMeta(key) ?? EPOCH;
}
