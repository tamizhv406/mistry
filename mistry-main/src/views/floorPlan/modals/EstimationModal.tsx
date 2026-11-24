import React from 'react';
import { Calculator, X, Share2, Sparkles } from 'lucide-react';
import type { FloorPlanUnit } from '../../../db/types';

export interface EstimationModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalFloorArea: number;
  totalWallLength: number;
  estimatedBricks: number;
  estimatedCementBags: number;
  estimatedSandCuFt: number;
  estimatedSteelKg: number;
  estimatedTileArea: number;
  estimatedPaintLitres: number;
  ceilingHeight: number;
  unit: FloorPlanUnit;
  onShareToWhatsApp: () => void;
  onOpenEstimator?: (sqFt: number) => void;
}

export const EstimationModal: React.FC<EstimationModalProps> = ({
  isOpen,
  onClose,
  totalFloorArea,
  totalWallLength,
  estimatedBricks,
  estimatedCementBags,
  estimatedSandCuFt,
  estimatedSteelKg,
  estimatedTileArea,
  estimatedPaintLitres,
  ceilingHeight,
  unit,
  onShareToWhatsApp,
  onOpenEstimator,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fp-calc-modal" role="dialog" aria-modal="true">
      <div className="fp-calc-dialog">
        <div className="fp-calc-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calculator size={20} color="#334155" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
              Floor Plan Material & Quantity Estimation
            </h3>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="fp-calc-body">
          <div className="fp-calc-metric-grid">
            <div className="fp-calc-metric-card">
              <span className="fp-calc-metric-title">Floor Area (தரை பரப்பு)</span>
              <span className="fp-calc-metric-num">{totalFloorArea.toFixed(0)}</span>
              <span className="fp-calc-metric-unit">{unit === 'feet' ? 'sq.ft' : 'sq.m'}</span>
            </div>
            <div className="fp-calc-metric-card">
              <span className="fp-calc-metric-title">Wall Length (சுவர் நீளம்)</span>
              <span className="fp-calc-metric-num">{totalWallLength.toFixed(1)}</span>
              <span className="fp-calc-metric-unit">{unit === 'feet' ? 'ft' : 'm'}</span>
            </div>
            <div className="fp-calc-metric-card">
              <span className="fp-calc-metric-title">Est. Bricks (செங்கல்)</span>
              <span className="fp-calc-metric-num">{estimatedBricks.toLocaleString()}</span>
              <span className="fp-calc-metric-unit">Standard modular</span>
            </div>
            <div className="fp-calc-metric-card">
              <span className="fp-calc-metric-title">Cement Bags (சிமெண்ட்)</span>
              <span className="fp-calc-metric-num">{estimatedCementBags}</span>
              <span className="fp-calc-metric-unit">50 kg bags</span>
            </div>
          </div>

          <table className="fp-calc-table">
            <thead>
              <tr>
                <th>Material Item (பொருட்கள்)</th>
                <th>Calculated Quantity</th>
                <th>Usage Basis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>செங்கல் (Red Clay Bricks / AAC)</strong></td>
                <td><strong style={{ color: '#b45309' }}>{estimatedBricks.toLocaleString()} pcs</strong></td>
                <td>Based on {totalWallLength.toFixed(1)} {unit} wall length & {ceilingHeight} ft ceiling height</td>
              </tr>
              <tr>
                <td><strong>சிமெண்ட் மூட்டைகள் (Cement Bags PPC/OPC)</strong></td>
                <td><strong style={{ color: '#1e293b' }}>{estimatedCementBags} bags</strong></td>
                <td>Masonry mortar 1:6 + Internal/External plaster</td>
              </tr>
              <tr>
                <td><strong>மணல் (Sand / M-Sand)</strong></td>
                <td><strong>{estimatedSandCuFt} cu.ft ({(estimatedSandCuFt / 100).toFixed(1)} units)</strong></td>
                <td>Mortar binding & wall finishing</td>
              </tr>
              <tr>
                <td><strong>கம்பி (Steel Rebar)</strong></td>
                <td><strong>{estimatedSteelKg} kg</strong></td>
                <td>Columns, lintels & sill bands</td>
              </tr>
              <tr>
                <td><strong>தரை டைல்ஸ் (Flooring Tiles)</strong></td>
                <td><strong>{estimatedTileArea} sq.ft</strong></td>
                <td>Carpet area + 10% cutting wastage</td>
              </tr>
              <tr>
                <td><strong>சுவர் பெயிண்ட் (Wall Paint 2 Coats)</strong></td>
                <td><strong>{estimatedPaintLitres} litres</strong></td>
                <td>Interior & exterior wall surface coverage</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="fp-calc-footer">
          <button
            type="button"
            className="btn btn-success"
            style={{ background: '#16a34a', color: '#ffffff', borderColor: '#16a34a', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            onClick={onShareToWhatsApp}
            title="Share estimate and plan details to WhatsApp"
            id="fp-calc-whatsapp-btn"
          >
            <Share2 size={16} />
            <span>WhatsApp-ல் அனுப்பு</span>
          </button>
          {onOpenEstimator && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const sqFt = unit === 'feet' ? totalFloorArea : totalFloorArea * 10.764;
                onClose();
                onOpenEstimator(sqFt);
              }}
            >
              <Sparkles size={16} /> Open in Building Calculator
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
