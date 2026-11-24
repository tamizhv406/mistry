/**
 * Single source of truth for database storage mode, cloud sync status,
 * and JSON backup safety timestamps.
 */
import { isSupabaseConfigured, supabase } from '../services/supabase';

export interface StorageSafetyStatus {
  storageType: 'IndexedDB (Offline-First Local)';
  isCloudConfigured: boolean;
  isCloudActive: boolean;
  cloudStatusText: string;
  lastBackupFormatted: string;
}

const BACKUP_TIMESTAMP_KEY = 'bm_last_backup_time';
let memoryBackupTime: string | null = null;

export function getLastBackupTime(): string | null {
  if (typeof window === 'undefined') return memoryBackupTime;
  try {
    return localStorage.getItem(BACKUP_TIMESTAMP_KEY) || memoryBackupTime;
  } catch {
    return memoryBackupTime;
  }
}

export function recordBackupSuccess(): string {
  const now = new Date();
  const formatted = now.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  memoryBackupTime = formatted;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(BACKUP_TIMESTAMP_KEY, formatted);
    } catch {
      // Ignore localStorage write errors
    }
  }
  return formatted;
}

export function getStorageSafetyStatus(): StorageSafetyStatus {
  const isCloudConfig = isSupabaseConfigured();
  const isCloudActive = Boolean(isCloudConfig && supabase);
  const lastBackup = getLastBackupTime();

  return {
    storageType: 'IndexedDB (Offline-First Local)',
    isCloudConfigured: isCloudConfig,
    isCloudActive,
    cloudStatusText: isCloudActive
      ? 'Connected & Syncing'
      : 'Offline Local Mode (Supabase not configured)',
    lastBackupFormatted: lastBackup || 'No backup downloaded yet',
  };
}
