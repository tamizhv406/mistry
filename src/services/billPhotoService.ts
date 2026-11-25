/**
 * Client-side bill photo compression, offline-first persistence, private bucket storage,
 * signed URL resolution, background sync, and safe photo deletion.
 *
 * Security & privacy:
 * - Bucket (`purchase-bills`) is strictly PRIVATE; public URLs are never used or generated.
 * - Remote paths are scoped under `${authUserId}/${projectId}/${purchaseId}.${ext}` so RLS
 *   enforces owner isolation.
 * - Offline captures are saved immediately in Dexie as compressed JPEG/WebP data URLs
 *   (`billPhotoSyncStatus: 'pending'`) and automatically uploaded & cleaned up when online.
 */
import { db } from '../db/db';
import type { BillPhotoSyncStatus } from '../db/types';
import { isSupabaseConfigured, supabase } from './supabase';
import { nowIso } from '../utils/datetime';

export const BILL_PHOTO_BUCKET = 'purchase-bills';
export const MAX_BILL_PHOTO_DIMENSION = 1280;
export const DEFAULT_BILL_PHOTO_QUALITY = 0.78;
export const MAX_BILL_PHOTO_INPUT_BYTES = 20 * 1024 * 1024; // 20 MB raw image guard
export const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour short-lived signed URL
const PENDING_DELETE_STORAGE_KEY = 'mistry_pending_bill_photo_deletes';

const ALLOWED_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i;

export type PurchasePhotoTable = 'materials' | 'rodEntries';

export interface BillPhotoRecordRef {
  billPhotoPath?: string;
  billPhotoLocalDataUrl?: string;
  billPhotoSyncStatus?: BillPhotoSyncStatus;
  billPhotoName?: string;
}

export interface CompressedBillPhoto {
  blob: Blob;
  dataUrl: string;
  fileName: string;
  mimeType: 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

export interface BillPhotoStorageClient {
  auth: {
    getSession(): Promise<{ data: { session: { user: { id: string } } | null } }>;
  };
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: Blob,
        options?: { contentType?: string; upsert?: boolean },
      ): Promise<{ data?: unknown; error: { message: string } | null }>;
      createSignedUrl(
        path: string,
        expiresIn: number,
      ): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
      remove(paths: string[]): Promise<{ data?: unknown; error: { message: string } | null }>;
    };
  };
}

export interface CompressBillPhotoOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/webp';
  /** Optional custom rasterizer for headless/unit testing without a browser DOM canvas. */
  rasterizer?: (
    file: Blob,
    opts: { maxDimension: number; quality: number; mimeType: 'image/jpeg' | 'image/webp' },
  ) => Promise<{ blob: Blob; dataUrl: string; width: number; height: number }>;
}

export function validateBillPhotoFile(
  file: Pick<File, 'type' | 'size'> & { name?: string },
): { ok: true } | { ok: false; error: string } {
  if (!file || typeof file.size !== 'number' || file.size <= 0) {
    return { ok: false, error: 'Selected image file is empty or unreadable.' };
  }
  if (file.size > MAX_BILL_PHOTO_INPUT_BYTES) {
    return { ok: false, error: 'Image is too large (maximum 20 MB before compression).' };
  }
  const mime = (file.type || '').toLowerCase();
  const hasImageMime = mime.startsWith('image/');
  const hasImageExt = !mime && typeof file.name === 'string' && ALLOWED_IMAGE_EXTENSIONS.test(file.name);
  if (!hasImageMime && !hasImageExt) {
    return { ok: false, error: 'Please select a valid image file (JPG, PNG, or WebP).' };
  }
  return { ok: true };
}

export function computeScaledDimensions(
  width: number,
  height: number,
  maxDimension: number = MAX_BILL_PHOTO_DIMENSION,
): { width: number; height: number } {
  const safeW = Math.max(1, Math.round(width));
  const safeH = Math.max(1, Math.round(height));
  const largest = Math.max(safeW, safeH);
  if (largest <= maxDimension) {
    return { width: safeW, height: safeH };
  }
  const scale = maxDimension / largest;
  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to encode compressed bill image.'));
      reader.readAsDataURL(blob);
      return;
    }
    // Fallback for Node test environments without FileReader
    blob
      .arrayBuffer()
      .then(buf => {
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = typeof btoa === 'function' ? btoa(binary) : '';
        resolve(`data:${blob.type || 'image/jpeg'};base64,${b64}`);
      })
      .catch(reject);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)?;base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) {
    throw new Error('Invalid local bill image data.');
  }
  const mimeType = match[1] || 'image/jpeg';
  const base64 = match[2].replace(/\s+/g, '');
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }
  // Pure JS fallback for runtimes without atob (zero Node Buffer dependency)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((base64.length * 3) / 4 - padding);
  let p = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const c1 = chars.indexOf(base64[i]);
    const c2 = chars.indexOf(base64[i + 1]);
    const c3 = chars.indexOf(base64[i + 2]);
    const c4 = chars.indexOf(base64[i + 3]);
    out[p++] = (c1 << 2) | (c2 >> 4);
    if (c3 >= 0 && p < out.length) out[p++] = ((c2 & 15) << 4) | (c3 >> 2);
    if (c4 >= 0 && p < out.length) out[p++] = ((c3 & 3) << 6) | c4;
  }
  return new Blob([out], { type: mimeType });
}

async function defaultCanvasRasterizer(
  file: Blob,
  opts: { maxDimension: number; quality: number; mimeType: 'image/jpeg' | 'image/webp' },
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  if (typeof document === 'undefined') {
    throw new Error('Image compression requires a browser canvas environment.');
  }

  let sourceWidth = 0;
  let sourceHeight = 0;
  let drawSource: CanvasImageSource;
  let cleanup: () => void = () => {};

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    sourceWidth = bitmap.width;
    sourceHeight = bitmap.height;
    drawSource = bitmap;
    cleanup = () => {
      try {
        bitmap.close();
      } catch {
        // Ignore close failures
      }
    };
  } else {
    const objectUrl = URL.createObjectURL(file);
    cleanup = () => URL.revokeObjectURL(objectUrl);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode selected image.'));
      el.src = objectUrl;
    });
    sourceWidth = img.naturalWidth || img.width;
    sourceHeight = img.naturalHeight || img.height;
    drawSource = img;
  }

  try {
    const target = computeScaledDimensions(sourceWidth, sourceHeight, opts.maxDimension);
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is unavailable on this device.');
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(drawSource, 0, 0, target.width, target.height);

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, opts.mimeType, opts.quality),
    );
    if (!blob) {
      const fallbackUrl = canvas.toDataURL(opts.mimeType, opts.quality);
      return {
        blob: dataUrlToBlob(fallbackUrl),
        dataUrl: fallbackUrl,
        width: target.width,
        height: target.height,
      };
    }
    const dataUrl = await blobToDataUrl(blob);
    return {
      blob,
      dataUrl,
      width: target.width,
      height: target.height,
    };
  } finally {
    cleanup();
  }
}

export async function compressBillPhoto(
  file: File | Blob,
  options: CompressBillPhotoOptions = {},
): Promise<CompressedBillPhoto> {
  const validation = validateBillPhotoFile(file as File);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const maxDimension = options.maxDimension ?? MAX_BILL_PHOTO_DIMENSION;
  const quality = Math.min(0.95, Math.max(0.4, options.quality ?? DEFAULT_BILL_PHOTO_QUALITY));
  const mimeType = options.mimeType ?? 'image/jpeg';
  const rasterize = options.rasterizer ?? defaultCanvasRasterizer;

  const { blob, dataUrl, width, height } = await rasterize(file, {
    maxDimension,
    quality,
    mimeType,
  });

  const rawName = (file as { name?: string }).name || `bill-${Date.now()}.jpg`;
  const ext = mimeType === 'image/webp' ? 'webp' : 'jpg';
  const normalizedBase = rawName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_') || 'bill';

  return {
    blob,
    dataUrl,
    fileName: `${normalizedBase}.${ext}`,
    mimeType,
    width,
    height,
    originalSize: file.size,
    compressedSize: blob.size,
  };
}

function sanitizeStorageSegment(value: string, label: string): string {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!cleaned) {
    throw new Error(`Invalid ${label} for bill photo storage path.`);
  }
  return cleaned;
}

export function buildBillPhotoStoragePath(params: {
  userId: string;
  projectId: string;
  purchaseId: string;
  ext?: 'jpg' | 'webp' | 'png';
}): string {
  const userSeg = sanitizeStorageSegment(params.userId, 'userId');
  const projectSeg = sanitizeStorageSegment(params.projectId, 'projectId');
  const purchaseSeg = sanitizeStorageSegment(params.purchaseId, 'purchaseId');
  const ext = params.ext || 'jpg';
  return `${userSeg}/${projectSeg}/${purchaseSeg}.${ext}`;
}

export function formatPhotoBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Signed URL Cache (Private Bucket) & Pending Offline Delete Queue
// ---------------------------------------------------------------------------

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export function clearBillPhotoUrlCache(path?: string): void {
  if (path) signedUrlCache.delete(path);
  else signedUrlCache.clear();
}

function readPendingDeletes(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_DELETE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string' && p.length > 0) : [];
  } catch {
    return [];
  }
}

function writePendingDeletes(paths: string[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (paths.length === 0) localStorage.removeItem(PENDING_DELETE_STORAGE_KEY);
    else localStorage.setItem(PENDING_DELETE_STORAGE_KEY, JSON.stringify(Array.from(new Set(paths))));
  } catch {
    // Ignore storage quota errors
  }
}

function queuePendingDelete(path: string): void {
  const current = readPendingDeletes();
  if (!current.includes(path)) {
    writePendingDeletes([...current, path]);
  }
}

function defaultStorageClient(): BillPhotoStorageClient | null {
  if (!isSupabaseConfigured() || !supabase) return null;
  return supabase as unknown as BillPhotoStorageClient;
}

function checkOnline(explicitOnline?: boolean): boolean {
  if (typeof explicitOnline === 'boolean') return explicitOnline;
  return typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
}

/**
 * Attaches a compressed bill photo to an existing saved purchase record in Dexie,
 * uploading immediately to the private `purchase-bills` bucket when online & authenticated,
 * or keeping the compressed data URL locally with `pending` status when offline.
 */
export async function attachBillPhotoToPurchase(params: {
  table: PurchasePhotoTable;
  purchaseId: string;
  siteId: string;
  photo: CompressedBillPhoto;
  client?: BillPhotoStorageClient | null;
  isOnline?: boolean;
}): Promise<{ status: 'synced' | 'pending'; storagePath?: string; error?: string }> {
  const table = db[params.table] as any;
  const now = nowIso();

  // Always save locally in Dexie first so offline UI & sync never lose the photo.
  await table.update(params.purchaseId, {
    billPhotoLocalDataUrl: params.photo.dataUrl,
    billPhotoName: params.photo.fileName,
    billPhotoSyncStatus: 'pending',
    updatedAt: now,
  });

  const client = params.client !== undefined ? params.client : defaultStorageClient();
  const online = checkOnline(params.isOnline);
  if (!online || !client) {
    return { status: 'pending' };
  }

  try {
    const { data: sessionData } = await client.auth.getSession();
    const authUserId = sessionData.session?.user?.id;
    if (!authUserId) {
      return { status: 'pending' };
    }

    const storagePath = buildBillPhotoStoragePath({
      userId: authUserId,
      projectId: params.siteId,
      purchaseId: params.purchaseId,
      ext: params.photo.mimeType === 'image/webp' ? 'webp' : 'jpg',
    });

    const { error } = await client.storage.from(BILL_PHOTO_BUCKET).upload(storagePath, params.photo.blob, {
      contentType: params.photo.mimeType,
      upsert: true,
    });
    if (error) {
      return { status: 'pending', error: error.message };
    }

    await table.update(params.purchaseId, {
      billPhotoPath: storagePath,
      billPhotoSyncStatus: 'synced',
      billPhotoLocalDataUrl: undefined,
      billPhotoName: params.photo.fileName,
      updatedAt: nowIso(),
    });

    // Seed short-lived in-memory preview cache so the just-uploaded photo renders immediately.
    signedUrlCache.set(storagePath, {
      url: params.photo.dataUrl,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return { status: 'synced', storagePath };
  } catch (err: any) {
    return { status: 'pending', error: err?.message || 'Bill photo queued for sync.' };
  }
}

/**
 * Resolves a displayable image URL for a purchase's bill photo:
 * - Returns the local compressed data URL when pending / offline.
 * - Otherwise fetches and caches a short-lived signed URL from the private Supabase bucket.
 * Never uses public bucket URLs.
 */
export async function resolveBillPhotoDisplayUrl(
  record: BillPhotoRecordRef | null | undefined,
  options: { client?: BillPhotoStorageClient | null; isOnline?: boolean; expiresInSeconds?: number } = {},
): Promise<{ url: string | null; status: BillPhotoSyncStatus | null; offlineUnavailable: boolean }> {
  if (!record) return { url: null, status: null, offlineUnavailable: false };

  if (record.billPhotoLocalDataUrl) {
    return {
      url: record.billPhotoLocalDataUrl,
      status: record.billPhotoSyncStatus || 'pending',
      offlineUnavailable: false,
    };
  }

  if (!record.billPhotoPath) {
    return { url: null, status: null, offlineUnavailable: false };
  }

  const cached = signedUrlCache.get(record.billPhotoPath);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return { url: cached.url, status: record.billPhotoSyncStatus || 'synced', offlineUnavailable: false };
  }

  const client = options.client !== undefined ? options.client : defaultStorageClient();
  const online = checkOnline(options.isOnline);
  if (!online || !client) {
    return { url: null, status: record.billPhotoSyncStatus || 'synced', offlineUnavailable: true };
  }

  try {
    const ttl = options.expiresInSeconds ?? SIGNED_URL_TTL_SECONDS;
    const { data, error } = await client.storage
      .from(BILL_PHOTO_BUCKET)
      .createSignedUrl(record.billPhotoPath, ttl);
    if (error || !data?.signedUrl) {
      return { url: null, status: record.billPhotoSyncStatus || 'synced', offlineUnavailable: true };
    }
    signedUrlCache.set(record.billPhotoPath, {
      url: data.signedUrl,
      expiresAt: Date.now() + ttl * 1000,
    });
    return { url: data.signedUrl, status: record.billPhotoSyncStatus || 'synced', offlineUnavailable: false };
  } catch {
    return { url: null, status: record.billPhotoSyncStatus || 'synced', offlineUnavailable: true };
  }
}

/**
 * Syncs all offline pending bill photos (uploads + pending deletions) when connectivity
 * and an authenticated Supabase session are available.
 */
export async function syncPendingBillPhotos(
  options: { client?: BillPhotoStorageClient | null; isOnline?: boolean } = {},
): Promise<{ uploaded: number; deleted: number; failed: number }> {
  const client = options.client !== undefined ? options.client : defaultStorageClient();
  if (!checkOnline(options.isOnline) || !client) {
    return { uploaded: 0, deleted: 0, failed: 0 };
  }

  const { data: sessionData } = await client.auth.getSession();
  const authUserId = sessionData.session?.user?.id;
  if (!authUserId) {
    return { uploaded: 0, deleted: 0, failed: 0 };
  }

  let uploaded = 0;
  let deleted = 0;
  let failed = 0;

  // 1. Drain any pending remote storage deletions captured while offline
  const pendingDeletes = readPendingDeletes();
  if (pendingDeletes.length > 0) {
    const remaining: string[] = [];
    for (const storagePath of pendingDeletes) {
      try {
        const { error } = await client.storage.from(BILL_PHOTO_BUCKET).remove([storagePath]);
        if (error) {
          remaining.push(storagePath);
          failed++;
        } else {
          clearBillPhotoUrlCache(storagePath);
          deleted++;
        }
      } catch {
        remaining.push(storagePath);
        failed++;
      }
    }
    writePendingDeletes(remaining);
  }

  // 2. Upload pending local bill photos for materials and rodEntries
  for (const tableName of ['materials', 'rodEntries'] as const) {
    const table = db[tableName] as any;
    const rows: any[] = await table
      .filter((r: any) => !r.isDeleted && Boolean(r.billPhotoLocalDataUrl) && r.billPhotoSyncStatus !== 'synced')
      .toArray();

    for (const row of rows) {
      try {
        const blob = dataUrlToBlob(row.billPhotoLocalDataUrl);
        const ext: 'jpg' | 'webp' | 'png' =
          blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
        const storagePath = buildBillPhotoStoragePath({
          userId: authUserId,
          projectId: row.siteId,
          purchaseId: row.id,
          ext,
        });

        const { error } = await client.storage.from(BILL_PHOTO_BUCKET).upload(storagePath, blob, {
          contentType: blob.type || 'image/jpeg',
          upsert: true,
        });
        if (error) {
          failed++;
          continue;
        }

        await table.update(row.id, {
          billPhotoPath: storagePath,
          billPhotoSyncStatus: 'synced',
          billPhotoLocalDataUrl: undefined,
          updatedAt: nowIso(),
        });
        signedUrlCache.delete(storagePath);
        uploaded++;
      } catch {
        failed++;
      }
    }
  }

  return { uploaded, deleted, failed };
}

/**
 * Deletes the attached bill photo from both Dexie and the private Supabase Storage bucket
 * without deleting the underlying purchase record.
 */
export async function deleteBillPhotoFromPurchase(params: {
  table: PurchasePhotoTable;
  purchaseId: string;
  client?: BillPhotoStorageClient | null;
  isOnline?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const table = db[params.table] as any;
  const existing = await table.get(params.purchaseId);
  if (!existing) {
    return { ok: false, error: 'Purchase record not found.' };
  }

  const remotePath: string | undefined = existing.billPhotoPath;
  if (remotePath) {
    clearBillPhotoUrlCache(remotePath);
    const client = params.client !== undefined ? params.client : defaultStorageClient();
    const online = checkOnline(params.isOnline);
    let removedRemotely = false;
    if (online && client) {
      try {
        const { data: sessionData } = await client.auth.getSession();
        if (sessionData.session?.user?.id) {
          const { error } = await client.storage.from(BILL_PHOTO_BUCKET).remove([remotePath]);
          if (!error) removedRemotely = true;
        }
      } catch {
        removedRemotely = false;
      }
    }
    if (!removedRemotely) {
      // Preserve path for cleanup once connectivity / session returns
      queuePendingDelete(remotePath);
    }
  }

  await table.update(params.purchaseId, {
    billPhotoPath: undefined,
    billPhotoLocalDataUrl: undefined,
    billPhotoSyncStatus: undefined,
    billPhotoName: undefined,
    updatedAt: nowIso(),
  });

  return { ok: true };
}
