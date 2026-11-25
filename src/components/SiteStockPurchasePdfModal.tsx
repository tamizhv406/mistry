import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileImage, FileText, Printer, X } from 'lucide-react';
import type { Material, RodEntry, Site } from '../db/types';
import { buildSiteStockPurchaseStatement, type SiteStockPurchaseStatement } from '../domain/stock';
import { addDays, monthKeyOf, todayKey } from '../utils/datetime';
import { formatINR } from '../utils/money';
import {
  downloadFile,
  generateSiteStockPurchasePdfBlob,
  printSiteStockPurchaseStatement,
  siteStockPurchasePdfFilename,
} from '../utils/pdfGenerator';

export interface SiteStockPurchasePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: Pick<Site, 'id' | 'name'>[];
  initialSiteId?: string;
  allowAllSites?: boolean;
  materials: Material[];
  rodEntries: RodEntry[];
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type PresetRange = 'month' | 'last30' | 'all' | 'custom';

/**
 * Mobile-first (390px) & desktop modal for filtering site stock purchases by project
 * and date range, previewing line items + bill photo references, and downloading/printing A4 PDF.
 */
export const SiteStockPurchasePdfModal: React.FC<SiteStockPurchasePdfModalProps> = ({
  isOpen,
  onClose,
  sites,
  initialSiteId,
  allowAllSites = true,
  materials,
  rodEntries,
  onNotify,
}) => {
  const today = todayKey();
  const thisMonthStart = `${monthKeyOf(today)}-01`;
  const last30Start = addDays(today, -30);

  const defaultSiteId = initialSiteId || sites[0]?.id || 'all';
  const [siteId, setSiteId] = useState<string>(defaultSiteId);
  const [preset, setPreset] = useState<PresetRange>('month');
  const [startDate, setStartDate] = useState<string>(thisMonthStart);
  const [endDate, setEndDate] = useState<string>(today);
  const [busyAction, setBusyAction] = useState<'download' | 'print' | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialSiteId) {
      setSiteId(initialSiteId);
    } else if (sites[0]?.id) {
      setSiteId(sites[0].id);
    }
  }, [isOpen, initialSiteId, sites]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const selectedSiteName = useMemo(() => {
    if (siteId === 'all') return 'All Projects (Combined)';
    return sites.find(s => s.id === siteId)?.name || 'Project';
  }, [siteId, sites]);

  const effectiveStart = preset === 'all' ? '' : startDate;
  const effectiveEnd = preset === 'all' ? '' : endDate;

  const statement: SiteStockPurchaseStatement = useMemo(
    () =>
      buildSiteStockPurchaseStatement({
        projectId: siteId,
        projectName: selectedSiteName,
        startDate: effectiveStart,
        endDate: effectiveEnd,
        materials,
        rods: rodEntries,
      }),
    [siteId, selectedSiteName, effectiveStart, effectiveEnd, materials, rodEntries],
  );

  if (!isOpen) return null;

  const applyPreset = (next: PresetRange) => {
    setPreset(next);
    if (next === 'month') {
      setStartDate(thisMonthStart);
      setEndDate(today);
    } else if (next === 'last30') {
      setStartDate(last30Start);
      setEndDate(today);
    } else if (next === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleDownloadPdf = async () => {
    setBusyAction('download');
    try {
      const blob = await generateSiteStockPurchasePdfBlob(statement);
      const filename = siteStockPurchasePdfFilename(statement);
      downloadFile(blob, filename);
      onNotify?.(`Downloaded ${filename}`, 'success');
    } catch {
      onNotify?.('Could not generate the stock purchase PDF.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePrint = () => {
    setBusyAction('print');
    try {
      printSiteStockPurchaseStatement(statement);
      onNotify?.(`Prepared printable stock purchase report for ${statement.projectName}.`, 'info');
    } catch {
      onNotify?.('Print is unavailable on this device. Try Download PDF instead.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div
      className="wpdf-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Site-Wise Stock Purchase PDF"
      onClick={onClose}
    >
      <div className="wpdf-dialog" onClick={e => e.stopPropagation()}>
        <div className="wpdf-header">
          <div className="wpdf-header-title">
            <FileText size={20} color="var(--color-primary)" aria-hidden="true" />
            <div>
              <h2>Stock Purchase PDF</h2>
              <p>{statement.projectName} · {statement.dateRangeLabel}</p>
            </div>
          </div>
          <button
            type="button"
            className="wpdf-close-btn"
            aria-label="Close Stock Purchase PDF"
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="wpdf-body">
          {/* Site selector */}
          <label className="wpdf-field">
            <span>Site / Project</span>
            <select
              aria-label="Select site"
              value={siteId}
              onChange={e => setSiteId(e.target.value)}
            >
              {allowAllSites && <option value="all">All Projects (Combined)</option>}
              {sites.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          {/* Quick Date Range Presets */}
          <div className="spdf-presets" role="group" aria-label="Quick date range presets">
            <button
              type="button"
              className={`spdf-preset-btn ${preset === 'month' ? 'is-active' : ''}`}
              onClick={() => applyPreset('month')}
            >
              This Month
            </button>
            <button
              type="button"
              className={`spdf-preset-btn ${preset === 'last30' ? 'is-active' : ''}`}
              onClick={() => applyPreset('last30')}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              className={`spdf-preset-btn ${preset === 'all' ? 'is-active' : ''}`}
              onClick={() => applyPreset('all')}
            >
              All Dates
            </button>
          </div>

          {/* From & To Date Pickers */}
          <div className="spdf-dates">
            <label className="wpdf-field">
              <span>From Date</span>
              <input
                type="date"
                aria-label="From date"
                value={startDate}
                max={endDate || today}
                onChange={e => {
                  setPreset('custom');
                  setStartDate(e.target.value);
                }}
              />
            </label>
            <label className="wpdf-field">
              <span>To Date</span>
              <input
                type="date"
                aria-label="To date"
                value={endDate}
                min={startDate || undefined}
                max={today}
                onChange={e => {
                  setPreset('custom');
                  setEndDate(e.target.value);
                }}
              />
            </label>
          </div>

          {/* Summary KPI Grid */}
          <div className="spdf-kpi-grid" aria-label="Stock purchase report summary">
            <div className="wpdf-kpi is-charcoal">
              <span>Purchases</span>
              <strong>{statement.totalPurchases}</strong>
            </div>
            <div className="wpdf-kpi is-success">
              <span>Bill Photos</span>
              <strong>{statement.purchasesWithBillPhoto}</strong>
            </div>
            <div className="wpdf-kpi is-primary">
              <span>Total Cost</span>
              <strong>{formatINR(statement.totalCost)}</strong>
            </div>
            <div className={`wpdf-kpi ${statement.totalBalanceDue > 0 ? 'is-danger' : 'is-success'}`}>
              <span>Balance Due</span>
              <strong>{formatINR(statement.totalBalanceDue)}</strong>
            </div>
          </div>

          {/* Purchase Preview List */}
          <div className="wpdf-days-wrap">
            <div className="wpdf-days-title">
              Purchases in Range ({statement.totalPurchases})
            </div>
            {statement.rows.length === 0 ? (
              <div className="wpdf-empty" style={{ border: 0, borderRadius: 0 }}>
                No stock purchases found for {statement.projectName} in this date range.
              </div>
            ) : (
              <div className="wpdf-days-list">
                {statement.rows.map(row => (
                  <div key={`${row.recordTable}-${row.id}`} className="spdf-row">
                    <div className="spdf-row-top">
                      <strong>{row.itemName}</strong>
                      <span className="spdf-row-total">{formatINR(row.totalCost)}</span>
                    </div>
                    <div className="spdf-row-sub">
                      <span>{row.dateFormatted} · {row.quantityDisplay} @ {formatINR(row.rate)}</span>
                      {row.supplier !== '—' && <span>Supplier: {row.supplier}</span>}
                      {row.invoiceNumber !== '—' && <span>Inv: {row.invoiceNumber}</span>}
                    </div>
                    <div className={`spdf-row-photo ${row.hasBillPhoto ? 'has-photo' : ''}`}>
                      <FileImage size={15} aria-hidden="true" />
                      <span>Bill Photo: {row.billPhotoReference}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="wpdf-footer">
          <button
            type="button"
            className="wpdf-btn wpdf-btn-secondary"
            onClick={handlePrint}
            disabled={busyAction !== null}
          >
            <Printer size={18} aria-hidden="true" />
            <span>{busyAction === 'print' ? 'Preparing…' : 'Print'}</span>
          </button>
          <button
            type="button"
            className="wpdf-btn wpdf-btn-primary"
            onClick={handleDownloadPdf}
            disabled={busyAction !== null}
          >
            <Download size={18} aria-hidden="true" />
            <span>{busyAction === 'download' ? 'Building…' : 'Download PDF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
