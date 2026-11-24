import React from 'react';
import { Armchair, X } from 'lucide-react';
import { ArchitecturalSymbol } from '../../../components/visuals/ArchitecturalSymbols';
import { FURNITURE_CATALOG, simplifyFurnitureLabel } from '../constants';
import type { FurnitureCatalogItem, ViewMode } from '../types';

export interface FurnitureLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  furnitureCategory: string;
  onCategoryChange: (cat: string) => void;
  viewMode: ViewMode;
  onSelectFurniture: (item: FurnitureCatalogItem) => void;
}

export const FurnitureLibraryModal: React.FC<FurnitureLibraryModalProps> = ({
  isOpen,
  onClose,
  furnitureCategory,
  onCategoryChange,
  viewMode,
  onSelectFurniture,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fp-furniture-modal" role="dialog" aria-modal="true">
      <div className="fp-furniture-dialog">
        <div className="fp-furniture-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Armchair size={20} color="#1e293b" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
              CAD Architectural Symbols & Furniture
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

        <div className="fp-furniture-categories">
          {['all', 'bedroom', 'living', 'dining', 'kitchen', 'bathroom', 'utility', 'outdoor'].map(cat => (
            <button
              key={cat}
              type="button"
              className={`fp-cat-chip ${furnitureCategory === cat ? 'active' : ''}`}
              onClick={() => onCategoryChange(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <div className="fp-furniture-grid">
          {FURNITURE_CATALOG
            .filter(item => furnitureCategory === 'all' || item.category === furnitureCategory)
            .map(item => (
              <div
                key={item.itemType}
                className="fp-furniture-item-card"
                onClick={() => onSelectFurniture(item)}
              >
                <div className="fp-furniture-icon-box">
                  <ArchitecturalSymbol
                    itemType={item.itemType}
                    width={48}
                    height={48}
                    blueprintMode={viewMode === 'blueprint'}
                  />
                </div>
                <div className="fp-furniture-name">{simplifyFurnitureLabel(item.itemType)}</div>
                <div className="fp-furniture-dims">{item.width}′ × {item.height}′</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
