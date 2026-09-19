import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search, X, Star, Clock, ChevronDown, ChevronRight,
  Plus, Layers, Trash2, HelpCircle, Filter, ArrowLeft
} from 'lucide-react';
import {
  SHAPE_CATEGORIES, SHAPE_LIBRARY_CATALOG,
  searchShapes, getFavoriteShapeIds, toggleFavoriteShape,
  getRecentShapeIds, getCustomShapes, deleteCustomShape, saveCustomShape
} from '../services/shapeLibraryCatalog';
import type { ShapeCategory, ShapeLibraryItem } from '../services/shapeLibraryCatalog';
import { ArchitecturalSymbol } from './visuals/ArchitecturalSymbols';
import type { User, FloorPlanUnit } from '../db/types';

interface FloorPlanShapeLibraryProps {
  user: User;
  unit: FloorPlanUnit;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSelectShape: (item: ShapeLibraryItem) => void;
  selectedCanvasElement?: { type: string; id: string } | null;
  onSaveSelectionAsCustom?: (name: string) => void;
  className?: string;
}

type TabType = 'all' | 'favorites' | 'recents' | 'custom';

export const FloorPlanShapeLibrary: React.FC<FloorPlanShapeLibraryProps> = ({
  user,
  unit,
  isOpen,
  onToggleOpen,
  onSelectShape,
  selectedCanvasElement,
  onSaveSelectionAsCustom,
  className = '',
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // Dedicated Category Filter ('all' or specific ShapeCategory)
  const [selectedCategory, setSelectedCategory] = useState<ShapeCategory | 'all'>('all');

  // Single-open Accordion state: only one category opens on its own at a time
  const [activeAccordionCategory, setActiveAccordionCategory] = useState<ShapeCategory | null>('Floor Plan');

  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [customItems, setCustomItems] = useState<ShapeLibraryItem[]>([]);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customShapeName, setCustomShapeName] = useState('');

  // Load favorites & recents on mount or user change
  useEffect(() => {
    if (user?.id) {
      setFavoriteIds(getFavoriteShapeIds(user.id));
      setRecentIds(getRecentShapeIds(user.id));
      setCustomItems(getCustomShapes(user.id));
    }
  }, [user]);

  const handleToggleFavorite = (e: React.MouseEvent, shapeId: string) => {
    e.stopPropagation();
    if (!user?.id) return;
    const next = toggleFavoriteShape(user.id, shapeId);
    setFavoriteIds(next);
  };

  const handleDeleteCustom = (e: React.MouseEvent, shapeId: string) => {
    e.stopPropagation();
    if (!user?.id) return;
    const next = deleteCustomShape(user.id, shapeId);
    setCustomItems(next);
  };

  const handleSaveCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customShapeName.trim() || !user?.id) return;

    if (onSaveSelectionAsCustom) {
      onSaveSelectionAsCustom(customShapeName.trim());
    } else {
      const newItem: ShapeLibraryItem = {
        id: `custom-${Date.now()}`,
        name: customShapeName.trim(),
        category: 'Furniture',
        width: 4,
        height: 4,
        description: `Custom User Shape: ${customShapeName.trim()}`,
        entityType: 'furniture',
        iconType: 'Room',
        isCustom: true,
      };
      const next = saveCustomShape(user.id, newItem);
      setCustomItems(next);
    }

    setCustomShapeName('');
    setShowCustomModal(false);
    setActiveTab('custom');
  };

  // Click on a category header: ONLY that one opens, closing others!
  const handleCategoryHeaderClick = (catId: ShapeCategory) => {
    setActiveAccordionCategory(prev => (prev === catId ? null : catId));
  };

  // Filtered shapes based on search & tab
  const allShapes = useMemo(() => {
    return [...SHAPE_LIBRARY_CATALOG, ...customItems];
  }, [customItems]);

  const searchedShapes = useMemo(() => {
    return searchShapes(searchQuery, allShapes);
  }, [searchQuery, allShapes]);

  // Group by category
  const shapesByCategory = useMemo(() => {
    const groups: Record<string, ShapeLibraryItem[]> = {};
    SHAPE_CATEGORIES.forEach(c => {
      groups[c.id] = [];
    });

    searchedShapes.forEach(item => {
      if (activeTab === 'favorites' && !favoriteIds.includes(item.id)) return;
      if (activeTab === 'recents' && !recentIds.includes(item.id)) return;
      if (activeTab === 'custom' && !item.isCustom) return;

      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });

    return groups;
  }, [searchedShapes, activeTab, favoriteIds, recentIds]);

  // When searching, auto-select category with results if searching actively
  useEffect(() => {
    if (searchQuery.trim()) {
      const firstWithResults = SHAPE_CATEGORIES.find(c => (shapesByCategory[c.id] || []).length > 0);
      if (firstWithResults && activeAccordionCategory !== firstWithResults.id) {
        setActiveAccordionCategory(firstWithResults.id);
      }
    }
  }, [searchQuery, shapesByCategory]);

  const totalResultsCount = useMemo(() => {
    return Object.values(shapesByCategory).reduce((acc, list) => acc + list.length, 0);
  }, [shapesByCategory]);

  // Drag handler
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: ShapeLibraryItem) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.setData('text/plain', item.name);

    const crt = e.currentTarget.cloneNode(true) as HTMLElement;
    crt.style.position = 'absolute';
    crt.style.top = '-1000px';
    crt.style.opacity = '0.9';
    crt.style.pointerEvents = 'none';
    document.body.appendChild(crt);
    e.dataTransfer.setDragImage(crt, 40, 40);
    setTimeout(() => {
      document.body.removeChild(crt);
    }, 0);
  };

  if (!isOpen) {
    return (
      <div className={`fp-shape-library-collapsed ${className}`}>
        <button
          type="button"
          className="fp-shape-library-toggle-open-btn"
          onClick={onToggleOpen}
          title="Open Shape Library (Catalog & Symbols)"
          id="fp-shape-lib-open-btn"
        >
          <Layers size={18} />
          <span className="fp-shape-toggle-text">Shapes</span>
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <aside
      className={`fp-shape-library-panel ${className}`}
      aria-label="Shape Library"
    >
      {/* ── Header with Title & Collapse ──────────────── */}
      <div className="fp-shape-lib-header">
        <div className="fp-shape-lib-title-row">
          <div className="fp-shape-lib-title">
            <Layers size={18} className="fp-shape-lib-icon" />
            <span>Shape Library</span>
          </div>
          <button
            type="button"
            className="fp-shape-lib-collapse-btn"
            onClick={onToggleOpen}
            title="Collapse Shape Library Panel"
            id="fp-shape-lib-collapse-btn"
          >
            <ChevronRight size={18} className="rotate-180" />
          </button>
        </div>

        {/* ── Search Bar ──────────────────────────────── */}
        <div className="fp-shape-search-wrap">
          <Search size={15} className="fp-shape-search-icon" />
          <input
            type="text"
            className="fp-shape-search-input"
            placeholder="Search shapes... (e.g. bed, door)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            id="fp-shape-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="fp-shape-search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Navigation Tabs ─────────────────────────── */}
        <div className="fp-shape-tabs" role="tablist">
          <button
            type="button"
            className={`fp-shape-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('all');
            }}
            title="All Categories"
          >
            All
          </button>
          <button
            type="button"
            className={`fp-shape-tab ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('favorites');
            }}
            title="⭐ Favorites"
          >
            <Star size={12} fill={activeTab === 'favorites' ? 'currentColor' : 'none'} />
            <span>Favs</span>
            {favoriteIds.length > 0 && <span className="fp-shape-tab-badge">{favoriteIds.length}</span>}
          </button>
          <button
            type="button"
            className={`fp-shape-tab ${activeTab === 'recents' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('recents');
            }}
            title="🕘 Recently Used"
          >
            <Clock size={12} />
            <span>Recent</span>
            {recentIds.length > 0 && <span className="fp-shape-tab-badge">{recentIds.length}</span>}
          </button>
          <button
            type="button"
            className={`fp-shape-tab ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('custom');
            }}
            title="🎨 Custom Shapes"
          >
            <span>Custom</span>
            {customItems.length > 0 && <span className="fp-shape-tab-badge">{customItems.length}</span>}
          </button>
        </div>

        {/* ── Category Quick Filter Pills Bar ─────────── */}
        {/* Allows opening each shape category individually on its own */}
        <div className="fp-shape-cat-pills-wrap">
          <div className="fp-shape-cat-pills">
            <button
              type="button"
              className={`fp-shape-cat-pill ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => {
                setSelectedCategory('all');
                if (!activeAccordionCategory) setActiveAccordionCategory('Floor Plan');
              }}
              title="Show all categories list"
            >
              All Types
            </button>
            {SHAPE_CATEGORIES.map(cat => {
              const count = (shapesByCategory[cat.id] || []).length;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`fp-shape-cat-pill ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setActiveAccordionCategory(cat.id);
                  }}
                  title={`Open ${cat.label} exclusively (${count} shapes)`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label.replace(/^\d+\.\s*/, '')}</span>
                  {count > 0 && <span className="fp-shape-cat-pill-count">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Subtitle Info / Single Category Banner ───── */}
        <div className="fp-shape-status-row">
          {selectedCategory !== 'all' ? (
            <div className="fp-shape-single-cat-badge">
              <span>Showing <strong>{selectedCategory}</strong> ({shapesByCategory[selectedCategory]?.length || 0} items)</span>
              <button
                type="button"
                className="fp-shape-view-all-link"
                onClick={() => setSelectedCategory('all')}
              >
                View All
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', fontSize: '0.72rem', color: '#64748b' }}>
              <span>{totalResultsCount} shapes • Click option to open</span>
              <span style={{ fontSize: '0.68rem', color: '#38bdf8' }}>1 open at a time</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Custom Object Creation Bar ────────────────── */}
      {selectedCanvasElement && (
        <div className="fp-shape-custom-save-bar">
          <div className="fp-shape-custom-info">
            Selected {selectedCanvasElement.type}
          </div>
          <button
            type="button"
            className="fp-shape-custom-btn"
            onClick={() => setShowCustomModal(true)}
            title="Save selected element as reusable custom shape"
          >
            <Plus size={14} /> Save As Shape
          </button>
        </div>
      )}

      {/* ── Scrollable Shape Library Content ──────────── */}
      <div
        ref={contentRef}
        className="fp-shape-lib-content"
        onWheel={e => e.stopPropagation()}
      >
        {totalResultsCount === 0 ? (
          <div className="fp-shape-empty-state">
            <HelpCircle size={28} className="fp-shape-empty-icon" />
            <p className="fp-shape-empty-title">No shapes found</p>
            <p className="fp-shape-empty-sub">
              {searchQuery ? `No shapes match "${searchQuery}"` : 'No shapes in this category or tab'}
            </p>
            {searchQuery && (
              <button
                type="button"
                className="fp-shape-clear-btn"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : selectedCategory !== 'all' ? (
          /* ── DEDICATED SINGLE CATEGORY VIEW: Full Height & Seamless Scrolling ── */
          <div className="fp-shape-single-view">
            <div className="fp-shape-grid">
              {(shapesByCategory[selectedCategory] || []).map(item => {
                const isFav = favoriteIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className="fp-shape-card"
                    draggable={true}
                    onDragStart={e => handleDragStart(e, item)}
                    onClick={() => onSelectShape(item)}
                    title={`${item.name} (${item.width}×${item.height} ${unit === 'feet' ? 'ft' : 'm'}) — ${item.description}. Drag onto canvas or click to add.`}
                    id={`shape-card-${item.id}`}
                  >
                    <div className="fp-shape-preview-box">
                      <ArchitecturalSymbol
                        itemType={item.iconType}
                        width={52}
                        height={44}
                      />
                      <button
                        type="button"
                        className={`fp-shape-fav-btn ${isFav ? 'active' : ''}`}
                        onClick={e => handleToggleFavorite(e, item.id)}
                        title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
                      >
                        <Star size={12} fill={isFav ? '#f59e0b' : 'none'} color={isFav ? '#f59e0b' : '#94a3b8'} />
                      </button>
                      {item.isCustom && (
                        <button
                          type="button"
                          className="fp-shape-delete-custom-btn"
                          onClick={e => handleDeleteCustom(e, item.id)}
                          title="Delete custom shape"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                    <span className="fp-shape-name">{item.name}</span>
                    <span className="fp-shape-dims">
                      {item.width}×{item.height} {unit === 'feet' ? 'ft' : 'm'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── ACCORDION VIEW: ONLY ONE CATEGORY OPENS SEPARATELY AT A TIME ── */
          SHAPE_CATEGORIES.map(category => {
            const items = shapesByCategory[category.id] || [];
            if (items.length === 0) return null;

            // When searching, all with results show; otherwise strictly only the active category is open
            const isOpenSeparately = searchQuery.trim()
              ? true
              : activeAccordionCategory === category.id;

            return (
              <div
                key={category.id}
                className={`fp-shape-category-group ${isOpenSeparately ? 'expanded' : 'collapsed'}`}
              >
                <button
                  type="button"
                  className={`fp-shape-category-header ${isOpenSeparately ? 'active' : ''}`}
                  onClick={() => handleCategoryHeaderClick(category.id)}
                  aria-expanded={isOpenSeparately}
                  title={`Click to open ${category.label} separately`}
                >
                  <div className="fp-shape-cat-left">
                    <span className="fp-shape-cat-icon">{category.icon}</span>
                    <span className="fp-shape-cat-title">{category.label}</span>
                  </div>
                  <div className="fp-shape-cat-right">
                    <span className="fp-shape-cat-count">{items.length}</span>
                    {isOpenSeparately ? (
                      <ChevronDown size={16} className="text-sky-400" />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </div>
                </button>

                {isOpenSeparately && (
                  <div className="fp-shape-grid">
                    {items.map(item => {
                      const isFav = favoriteIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className="fp-shape-card"
                          draggable={true}
                          onDragStart={e => handleDragStart(e, item)}
                          onClick={() => onSelectShape(item)}
                          title={`${item.name} (${item.width}×${item.height} ${unit === 'feet' ? 'ft' : 'm'}) — ${item.description}. Drag onto canvas or click to add.`}
                          id={`shape-card-${item.id}`}
                        >
                          <div className="fp-shape-preview-box">
                            <ArchitecturalSymbol
                              itemType={item.iconType}
                              width={52}
                              height={44}
                            />
                            <button
                              type="button"
                              className={`fp-shape-fav-btn ${isFav ? 'active' : ''}`}
                              onClick={e => handleToggleFavorite(e, item.id)}
                              title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
                            >
                              <Star size={12} fill={isFav ? '#f59e0b' : 'none'} color={isFav ? '#f59e0b' : '#94a3b8'} />
                            </button>
                            {item.isCustom && (
                              <button
                                type="button"
                                className="fp-shape-delete-custom-btn"
                                onClick={e => handleDeleteCustom(e, item.id)}
                                title="Delete custom shape"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                          <span className="fp-shape-name">{item.name}</span>
                          <span className="fp-shape-dims">
                            {item.width}×{item.height} {unit === 'feet' ? 'ft' : 'm'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Custom Shape Save Dialog ─────────────────── */}
      {showCustomModal && (
        <div className="fp-custom-shape-modal" role="dialog" aria-modal="true">
          <div className="fp-custom-shape-dialog">
            <div className="fp-custom-shape-header">
              <h4>Save As Custom Shape</h4>
              <button
                type="button"
                className="fp-shape-close-btn"
                onClick={() => setShowCustomModal(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveCustomSubmit} className="fp-custom-shape-form">
              <label htmlFor="custom-shape-name-input">Shape Name</label>
              <input
                id="custom-shape-name-input"
                type="text"
                placeholder="e.g. Master Walk-in Closet, Custom Island"
                value={customShapeName}
                onChange={e => setCustomShapeName(e.target.value)}
                autoFocus
                required
              />
              <div className="fp-custom-shape-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowCustomModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Save Shape
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};
