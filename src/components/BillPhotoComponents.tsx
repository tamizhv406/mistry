import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CloudOff,
  FileImage,
  Image as ImageIcon,
  Loader2,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { BillPhotoSyncStatus } from '../db/types';
import {
  compressBillPhoto,
  deleteBillPhotoFromPurchase,
  formatPhotoBytes,
  resolveBillPhotoDisplayUrl,
  type CompressedBillPhoto,
  type PurchasePhotoTable,
} from '../services/billPhotoService';

export interface BillPhotoRecordRef {
  purchaseRecordId: string;
  recordTable: PurchasePhotoTable;
  siteId: string;
  title: string;
  subtitle?: string;
  billPhotoPath?: string;
  billPhotoLocalDataUrl?: string;
  billPhotoSyncStatus?: BillPhotoSyncStatus;
  billPhotoName?: string;
}

export interface BillPhotoPickerProps {
  value: CompressedBillPhoto | null;
  onChange: (photo: CompressedBillPhoto | null) => void;
  disabled?: boolean;
  statusMessage?: string | null;
  existingUrl?: string | null;
  existingName?: string;
  onRemoveExisting?: () => void;
  compact?: boolean;
}

/**
 * Camera + gallery photo selector for purchase forms.
 * Compresses selected images on-device immediately so uploads and offline storage stay light.
 */
export const BillPhotoPicker: React.FC<BillPhotoPickerProps> = ({
  value,
  onChange,
  disabled = false,
  statusMessage,
  existingUrl,
  existingName,
  onRemoveExisting,
  compact = false,
}) => {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still triggers onChange
    e.target.value = '';
    if (!file) return;

    setError(null);
    setCompressing(true);
    try {
      const compressed = await compressBillPhoto(file);
      onChange(compressed);
    } catch (err) {
      setError((err as Error)?.message || 'Could not process the selected photo.');
    } finally {
      setCompressing(false);
    }
  };

  const previewUrl = value?.dataUrl || existingUrl || null;
  const previewName = value?.fileName || existingName || 'Bill photo';
  const sizeLabel = value
    ? `${formatPhotoBytes(value.compressedSize)}${value.originalSize > value.compressedSize ? ` (from ${formatPhotoBytes(value.originalSize)})` : ''}`
    : null;

  return (
    <div className={`bph-picker ${compact ? 'is-compact' : ''}`}>
      <div className="bph-picker-head">
        <span className="bph-picker-label">Bill / Invoice Photo (optional)</span>
        <span className="bph-picker-sub">Compressed automatically</span>
      </div>

      {/* Hidden inputs: one forces camera capture on phones, the other opens photo library */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="bph-hidden-input"
        aria-label="Take bill photo with camera"
        onChange={handleFileSelected}
        disabled={disabled || compressing}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="bph-hidden-input"
        aria-label="Choose bill photo from gallery"
        onChange={handleFileSelected}
        disabled={disabled || compressing}
      />

      {!previewUrl ? (
        <div className="bph-actions">
          <button
            type="button"
            className="bph-pick-btn"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled || compressing}
          >
            {compressing ? <Loader2 size={18} className="bph-spin" aria-hidden="true" /> : <Camera size={18} aria-hidden="true" />}
            <span>{compressing ? 'Preparing…' : 'Take Photo'}</span>
          </button>
          <button
            type="button"
            className="bph-pick-btn"
            onClick={() => galleryInputRef.current?.click()}
            disabled={disabled || compressing}
          >
            <ImageIcon size={18} aria-hidden="true" />
            <span>Gallery</span>
          </button>
        </div>
      ) : (
        <div className="bph-preview-card">
          <img
            src={previewUrl}
            alt="Selected bill preview"
            className="bph-preview-thumb"
          />
          <div className="bph-preview-meta">
            <span className="bph-preview-name">{previewName}</span>
            {sizeLabel && <span className="bph-preview-size">{sizeLabel}</span>}
            {statusMessage && <span className="bph-preview-status">{statusMessage}</span>}
          </div>
          <button
            type="button"
            className="bph-remove-btn"
            aria-label="Remove bill photo"
            disabled={disabled || compressing}
            onClick={() => {
              setError(null);
              if (value) {
                onChange(null);
              } else {
                onRemoveExisting?.();
              }
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
            <span>Remove</span>
          </button>
        </div>
      )}

      {error && (
        <div className="bph-error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export interface BillPhotoThumbnailProps {
  record: Pick<BillPhotoRecordRef, 'billPhotoPath' | 'billPhotoLocalDataUrl' | 'billPhotoSyncStatus' | 'billPhotoName'>;
  label?: string;
  onOpen: () => void;
}

/**
 * Compact 44px+ tap target displaying the purchase bill thumbnail (local or private signed URL).
 */
export const BillPhotoThumbnail: React.FC<BillPhotoThumbnailProps> = ({
  record,
  label = 'View bill photo',
  onOpen,
}) => {
  const [url, setUrl] = useState<string | null>(record.billPhotoLocalDataUrl || null);
  const [offlineUnavailable, setOfflineUnavailable] = useState(false);

  const hasPhoto = !!(record.billPhotoPath || record.billPhotoLocalDataUrl);

  useEffect(() => {
    let active = true;
    if (!hasPhoto) {
      setUrl(null);
      setOfflineUnavailable(false);
      return;
    }
    if (record.billPhotoLocalDataUrl) {
      setUrl(record.billPhotoLocalDataUrl);
      setOfflineUnavailable(false);
    }

    void resolveBillPhotoDisplayUrl(record).then(res => {
      if (!active) return;
      setUrl(res.url);
      setOfflineUnavailable(res.offlineUnavailable);
    });

    return () => {
      active = false;
    };
  }, [hasPhoto, record.billPhotoLocalDataUrl, record.billPhotoPath, record.billPhotoSyncStatus]);

  if (!hasPhoto) return null;

  const isPending = record.billPhotoSyncStatus === 'pending' || record.billPhotoSyncStatus === 'failed';

  return (
    <button
      type="button"
      className="bph-thumb-btn"
      aria-label={label}
      title={label}
      onClick={e => {
        e.stopPropagation();
        onOpen();
      }}
    >
      {url ? (
        <img src={url} alt={record.billPhotoName || 'Bill photo'} className="bph-thumb-img" />
      ) : offlineUnavailable ? (
        <span className="bph-thumb-fallback" title="Saved in cloud — connect to view">
          <CloudOff size={18} aria-hidden="true" />
        </span>
      ) : (
        <span className="bph-thumb-fallback">
          <FileImage size={18} aria-hidden="true" />
        </span>
      )}
      {isPending && (
        <span
          className={`bph-sync-dot ${record.billPhotoSyncStatus === 'failed' ? 'is-failed' : 'is-pending'}`}
          title={record.billPhotoSyncStatus === 'failed' ? 'Photo sync retry needed' : 'Saved offline, pending cloud upload'}
          aria-hidden="true"
        />
      )}
    </button>
  );
};

export interface BillPhotoViewerModalProps {
  record: BillPhotoRecordRef | null;
  onClose: () => void;
  onDeleted?: (record: BillPhotoRecordRef) => void;
}

/**
 * Full-size responsive lightbox for viewing, zooming, and deleting a purchase bill photo.
 */
export const BillPhotoViewerModal: React.FC<BillPhotoViewerModalProps> = ({
  record,
  onClose,
  onDeleted,
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [offlineUnavailable, setOfflineUnavailable] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!record) return;
    setZoomed(false);
    setConfirmDelete(false);
    setError(null);
    let active = true;
    setLoading(true);

    void resolveBillPhotoDisplayUrl(record)
      .then(res => {
        if (!active) return;
        setUrl(res.url);
        setOfflineUnavailable(res.offlineUnavailable);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [record]);

  useEffect(() => {
    if (!record) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [record, onClose]);

  if (!record) return null;

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    void resolveBillPhotoDisplayUrl(record)
      .then(res => {
        setUrl(res.url);
        setOfflineUnavailable(res.offlineUnavailable);
      })
      .finally(() => setLoading(false));
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await deleteBillPhotoFromPurchase({
        table: record.recordTable,
        purchaseId: record.purchaseRecordId,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onDeleted?.(record);
      onClose();
    } catch (err) {
      setError((err as Error)?.message || 'Could not remove bill photo.');
    } finally {
      setDeleting(false);
    }
  };

  const syncBadgeLabel =
    record.billPhotoSyncStatus === 'pending'
      ? 'Saved offline · uploads when online'
      : record.billPhotoSyncStatus === 'failed'
        ? 'Upload retry queued'
        : 'Private cloud storage';

  return (
    <div
      className="bph-lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Bill photo for ${record.title}`}
      onClick={onClose}
    >
      <div className="bph-lightbox-card" onClick={e => e.stopPropagation()}>
        <div className="bph-lightbox-head">
          <div className="bph-lightbox-titles">
            <h3 className="bph-lightbox-title">{record.title}</h3>
            <p className="bph-lightbox-sub">
              {record.subtitle ? `${record.subtitle} · ` : ''}{syncBadgeLabel}
            </p>
          </div>
          <div className="bph-lightbox-top-actions">
            {url && (
              <button
                type="button"
                className="bph-icon-btn"
                onClick={() => setZoomed(z => !z)}
                aria-label={zoomed ? 'Fit image to screen' : 'Zoom in on bill photo'}
                title={zoomed ? 'Fit to screen' : 'Zoom in'}
              >
                {zoomed ? <ZoomOut size={20} aria-hidden="true" /> : <ZoomIn size={20} aria-hidden="true" />}
              </button>
            )}
            <button
              type="button"
              className="bph-icon-btn"
              onClick={onClose}
              aria-label="Close bill photo viewer"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className={`bph-lightbox-stage ${zoomed ? 'is-zoomed' : ''}`}>
          {loading ? (
            <div className="bph-lightbox-empty">
              <Loader2 size={28} className="bph-spin" aria-hidden="true" />
              <span>Loading bill photo…</span>
            </div>
          ) : url ? (
            <img
              src={url}
              alt={record.billPhotoName || record.title}
              className={`bph-lightbox-img ${zoomed ? 'is-zoomed' : ''}`}
              onClick={() => setZoomed(z => !z)}
            />
          ) : (
            <div className="bph-lightbox-empty">
              <CloudOff size={32} aria-hidden="true" />
              <span>
                {offlineUnavailable
                  ? 'This bill photo is stored securely in cloud backup. Go online to open it.'
                  : 'Bill photo could not be loaded right now.'}
              </span>
              <button type="button" className="bph-retry-btn" onClick={handleRetry}>
                Try again
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bph-error bph-lightbox-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="bph-lightbox-foot">
          {!confirmDelete ? (
            <>
              <button
                type="button"
                className="bph-foot-btn is-danger"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
              >
                <Trash2 size={18} aria-hidden="true" />
                <span>Delete photo</span>
              </button>
              <button type="button" className="bph-foot-btn is-secondary" onClick={onClose}>
                Close
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="bph-foot-btn is-secondary"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Keep photo
              </button>
              <button
                type="button"
                className="bph-foot-btn is-danger-solid"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 size={18} aria-hidden="true" />
                <span>{deleting ? 'Removing…' : 'Confirm delete'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
