import React, { useState, useEffect } from 'react';
import {
  Scale,
  Building2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  PlusCircle,
  Calendar,
  Layers,
  IndianRupee,
  FileText,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type {
  Site,
  SiteFinancialSummary,
  Material,
  RodEntry,
  BuildingEstimate,
} from '../../db/types';

interface EstimateVarianceTabProps {
  site: Site;
  summary: SiteFinancialSummary;
  materials: Material[];
  rodEntries: RodEntry[];
  onOpenEstimator?: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const EstimateVarianceTab: React.FC<EstimateVarianceTabProps> = ({
  site,
  summary,
  materials,
  rodEntries,
  onOpenEstimator,
  onNotify,
}) => {
  // Query estimates linked to this site or all saved estimates
  const siteEstimates = useLiveQuery(
    () => db.estimates.filter(e => !e.isDeleted && e.siteId === site.id).toArray(),
    [site.id]
  ) || [];

  const allEstimates = useLiveQuery(
    () => db.estimates.filter(e => !e.isDeleted).toArray()
  ) || [];

  const [selectedEstimateId, setSelectedEstimateId] = useState<string>('');

  useEffect(() => {
    if (siteEstimates.length > 0 && !selectedEstimateId) {
      setSelectedEstimateId(siteEstimates[0].id);
    } else if (allEstimates.length > 0 && !selectedEstimateId) {
      setSelectedEstimateId(allEstimates[0].id);
    }
  }, [siteEstimates, allEstimates, selectedEstimateId]);

  const selectedEstimate = allEstimates.find(e => e.id === selectedEstimateId);

  // Calculate actual site material purchases
  const actualCementBags = materials
    .filter(m => m.category === 'cement')
    .reduce((acc, m) => acc + (m.quantity || 0), 0);
  const actualCementCost = materials
    .filter(m => m.category === 'cement')
    .reduce((acc, m) => acc + (m.totalAmount || 0), 0);

  const actualSandLoads = materials
    .filter(m => m.category === 'sand')
    .reduce((acc, m) => acc + (m.quantity || 0), 0);
  const actualSandCost = materials
    .filter(m => m.category === 'sand')
    .reduce((acc, m) => acc + (m.totalAmount || 0), 0);

  const actualMsandLoads = materials
    .filter(m => m.category === 'msand')
    .reduce((acc, m) => acc + (m.quantity || 0), 0);
  const actualMsandCost = materials
    .filter(m => m.category === 'msand')
    .reduce((acc, m) => acc + (m.totalAmount || 0), 0);

  const actualBricksPieces = materials
    .filter(m => m.category === 'bricks')
    .reduce((acc, m) => acc + (m.quantity || 0), 0);
  const actualBricksCost = materials
    .filter(m => m.category === 'bricks')
    .reduce((acc, m) => acc + (m.totalAmount || 0), 0);

  const actualSteelKg = rodEntries.reduce((acc, r) => acc + (r.weightKg || 0), 0);
  const actualSteelCost = rodEntries.reduce((acc, r) => acc + (r.totalAmount || 0), 0);

  const actualTotalMaterialCost = summary.materialCost;
  const actualTotalLabourCost = summary.labourGrossSalary;
  const actualTotalProjectCost = summary.totalCost;

  // Build comparison rows if estimate is selected
  const comparisonRows = selectedEstimate
    ? [
        {
          item: 'Cement',
          unit: 'Bags',
          icon: '🧱',
          estimatedQty: selectedEstimate.materialEstimates.find(m => m.material === 'Cement')?.quantity || 0,
          actualQty: actualCementBags,
          estimatedCost: selectedEstimate.materialEstimates.find(m => m.material === 'Cement')?.estimatedCost || 0,
          actualCost: actualCementCost,
        },
        {
          item: 'Sand / M-Sand',
          unit: 'CFT / Units',
          icon: '🏖️',
          estimatedQty: (selectedEstimate.materialEstimates.find(m => m.material === 'Sand')?.quantity || 0) +
            (selectedEstimate.materialEstimates.find(m => m.material === 'M-Sand')?.quantity || 0),
          actualQty: `${actualSandLoads + actualMsandLoads} Units`,
          estimatedCost: (selectedEstimate.materialEstimates.find(m => m.material === 'Sand')?.estimatedCost || 0) +
            (selectedEstimate.materialEstimates.find(m => m.material === 'M-Sand')?.estimatedCost || 0),
          actualCost: actualSandCost + actualMsandCost,
        },
        {
          item: 'Chamber Bricks',
          unit: 'Pieces',
          icon: '🧱',
          estimatedQty: selectedEstimate.materialEstimates.find(m => m.material === 'Bricks')?.quantity || 0,
          actualQty: actualBricksPieces,
          estimatedCost: selectedEstimate.materialEstimates.find(m => m.material === 'Bricks')?.estimatedCost || 0,
          actualCost: actualBricksCost,
        },
        {
          item: 'TMT Steel Rebars',
          unit: 'Kg',
          icon: '🏗️',
          estimatedQty: selectedEstimate.materialEstimates.find(m => m.material === 'Steel')?.quantity || 0,
          actualQty: actualSteelKg,
          estimatedCost: selectedEstimate.materialEstimates.find(m => m.material === 'Steel')?.estimatedCost || 0,
          actualCost: actualSteelCost,
        },
        {
          item: 'Civil Labour Wages',
          unit: 'Lump sum',
          icon: '👷',
          estimatedQty: `${selectedEstimate.convertedBuiltUpSqFt} sq.ft`,
          actualQty: 'Work in progress',
          estimatedCost: selectedEstimate.estimatedLabourCost,
          actualCost: actualTotalLabourCost,
        },
      ]
    : [];

  const totalEstimatedCost = selectedEstimate ? selectedEstimate.totalEstimatedCost : 0;
  const costDiff = actualTotalProjectCost - totalEstimatedCost;
  const isOverBudget = costDiff > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header & Estimate Selector */}
      <div
        className="card"
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          padding: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Scale size={24} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>
              Estimate vs Actual Expenditure Variance
            </h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '4px 0 0' }}>
            Compare preliminary material quantities & costs against actual site ledgers and purchases
          </p>
        </div>

        {/* Estimate Dropdown & New Estimate Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <select
            className="form-input"
            value={selectedEstimateId}
            onChange={e => setSelectedEstimateId(e.target.value)}
            style={{ minWidth: '240px', fontWeight: 600 }}
          >
            <option value="">-- Choose Estimate to Compare --</option>
            {allEstimates.map(est => (
              <option key={est.id} value={est.id}>
                {est.estimateName} ({est.convertedBuiltUpSqFt} sq.ft — ₹{est.totalEstimatedCost.toLocaleString('en-IN')})
                {est.siteId === site.id ? ' ★' : ''}
              </option>
            ))}
          </select>

          {onOpenEstimator && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onOpenEstimator}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}
            >
              <PlusCircle size={16} /> New Estimate
            </button>
          )}
        </div>
      </div>

      {selectedEstimate ? (
        <>
          {/* Executive Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {/* Estimated Budget */}
            <div
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '1.25rem',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Preliminary Estimated Budget
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                ₹{totalEstimatedCost.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {selectedEstimate.convertedBuiltUpSqFt} sq.ft ({selectedEstimate.floors} floors)
              </span>
            </div>

            {/* Actual Site Expenditure */}
            <div
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '1.25rem',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Actual Expenditure Incurred
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                ₹{actualTotalProjectCost.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Total recorded across all site modules
              </span>
            </div>

            {/* Budget Variance */}
            <div
              style={{
                background: isOverBudget ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                border: `1.5px solid ${isOverBudget ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
                borderRadius: '12px',
                padding: '1.25rem',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: isOverBudget ? '#f87171' : '#4ade80', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {isOverBudget ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {isOverBudget ? 'Budget Overrun' : 'Current Savings / In Budget'}
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: isOverBudget ? '#f87171' : '#4ade80', marginTop: '4px' }}>
                {isOverBudget ? '+' : ''}₹{costDiff.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.8rem', color: isOverBudget ? '#f87171' : '#4ade80' }}>
                {totalEstimatedCost > 0 ? `${Math.abs(Math.round((costDiff / totalEstimatedCost) * 100))}% variance` : '—'}
              </span>
            </div>
          </div>

          {/* Variance Table */}
          <div
            className="card"
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              padding: '1.25rem',
              overflowX: 'auto',
            }}
          >
            <h4 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: 'var(--text-main)' }}>
              Material & Labour Breakdown: Estimated vs Actual
            </h4>

            <table className="data-table" style={{ width: '100%', fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Estimated Qty</th>
                  <th>Actual Site Qty</th>
                  <th>Estimated Cost (₹)</th>
                  <th>Actual Cost (₹)</th>
                  <th>Cost Variance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(row => {
                  const rowDiff = row.actualCost - row.estimatedCost;
                  const rowOver = rowDiff > 0;
                  const pct = row.estimatedCost > 0 ? Math.round((rowDiff / row.estimatedCost) * 100) : 0;

                  return (
                    <tr key={row.item}>
                      <td>
                        <strong>
                          {row.icon} {row.item}
                        </strong>
                      </td>
                      <td>
                        {typeof row.estimatedQty === 'number'
                          ? `${row.estimatedQty.toLocaleString('en-IN')} ${row.unit}`
                          : row.estimatedQty}
                      </td>
                      <td>
                        {typeof row.actualQty === 'number'
                          ? `${row.actualQty.toLocaleString('en-IN')} ${row.unit}`
                          : row.actualQty}
                      </td>
                      <td>₹{row.estimatedCost.toLocaleString('en-IN')}</td>
                      <td style={{ fontWeight: 700 }}>₹{row.actualCost.toLocaleString('en-IN')}</td>
                      <td style={{ color: rowOver ? 'var(--danger)' : '#4ade80', fontWeight: 700 }}>
                        {rowOver ? '+' : ''}₹{rowDiff.toLocaleString('en-IN')} ({rowOver ? '+' : ''}{pct}%)
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: rowOver ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            color: rowOver ? '#f87171' : '#4ade80',
                          }}
                        >
                          {rowOver ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                          {rowOver ? 'Overrun' : 'In Budget'}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {/* Grand Totals */}
                <tr style={{ background: 'rgba(255, 184, 0, 0.08)', fontWeight: 800 }}>
                  <td colSpan={3}><strong>TOTAL PROJECT EXPENDITURE</strong></td>
                  <td>₹{totalEstimatedCost.toLocaleString('en-IN')}</td>
                  <td>₹{actualTotalProjectCost.toLocaleString('en-IN')}</td>
                  <td style={{ color: isOverBudget ? 'var(--danger)' : '#4ade80' }}>
                    {isOverBudget ? '+' : ''}₹{costDiff.toLocaleString('en-IN')}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '0.78rem',
                        background: isOverBudget ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                        color: isOverBudget ? '#f87171' : '#4ade80',
                      }}
                    >
                      {isOverBudget ? 'Over Budget' : 'Within Budget'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Variance Insights Note */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderLeft: '3px solid var(--primary)',
              borderRadius: '6px',
              padding: '0.85rem 1rem',
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
            <strong>Note on Estimator Variance:</strong> Variations between preliminary estimates and actual procurement
            occur normally due to changes in architectural layouts, slab thicknesses, foundation depth dictated by soil
            conditions, and local market commodity price fluctuations. Use this variance sheet to keep owner and contractor
            aligned on actual bills versus preliminary budget expectations.
          </div>
        </>
      ) : (
        <div
          className="card"
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            padding: '3rem 1.5rem',
            textAlign: 'center',
          }}
        >
          <Scale size={48} color="var(--primary)" style={{ opacity: 0.6, marginBottom: '1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)' }}>No Estimate Linked Yet</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            To view a side-by-side comparison of preliminary material quantities and costs against your actual site purchases,
            create or link a building estimate.
          </p>
          {onOpenEstimator && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onOpenEstimator}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
            >
              <PlusCircle size={18} /> Open Building Estimator
            </button>
          )}
        </div>
      )}
    </div>
  );
};
