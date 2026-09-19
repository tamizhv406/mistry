import React, { useState, useEffect, useRef } from 'react';
import {
  PenTool,
  Plus,
  Building2,
  Calendar,
  Edit2,
  Trash2,
  Copy,
  ExternalLink,
  Search,
  Ruler,
  Grid3x3,
  FolderOpen,
  AlertCircle,
  X,
  Upload,
  LayoutTemplate,
  Clock,
  CheckCircle2,
  List,
  Grid,
  ArrowUpDown,
  Filter,
  FileCheck,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { FloorPlan, FloorPlanUnit, Site, User } from '../db/types';
import {
  softDeleteFloorPlan,
  duplicateFloorPlan,
  createFloorPlan,
  STARTER_TEMPLATES,
  type FloorPlanStarterTemplate,
} from '../services/floorPlanService';

interface FloorPlanListViewProps {
  user: User;
  onOpenEditor: (planId: string | null, siteId?: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  initialSiteId?: string | null;
  onOpenNewSiteModal?: () => void;
}

export const FloorPlanListView: React.FC<FloorPlanListViewProps> = ({
  user,
  onOpenEditor,
  onNotify,
  initialSiteId,
  onOpenNewSiteModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSiteId, setFilterSiteId] = useState<string>(initialSiteId || 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'name' | 'area'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FloorPlanStarterTemplate | null>(null);
  const [templateSiteId, setTemplateSiteId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update filter if initialSiteId changes
  useEffect(() => {
    if (initialSiteId) setFilterSiteId(initialSiteId);
  }, [initialSiteId]);

  const floorPlans =
    useLiveQuery(async () => {
      const isElevated =
        user.role === 'ADMIN' ||
        user.role === 'SUPER_ADMIN' ||
        user.role === 'SUB_ADMIN';

      if (isElevated) {
        return db.floorPlans
          .filter(fp => !fp.isDeleted)
          .reverse()
          .sortBy('updatedAt');
      }
      return db.floorPlans
        .filter(fp => !fp.isDeleted && fp.userId === user.id)
        .reverse()
        .sortBy('updatedAt');
    }, [user]) || [];

  const userSites =
    useLiveQuery(async () => {
      return db.getSitesForUser(user);
    }, [user]) || [];

  // Filter floor plans
  let filtered = floorPlans.filter(fp => {
    const matchesSearch =
      !searchQuery ||
      fp.buildingName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fp.floorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (fp.siteName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSite = filterSiteId === 'all' || fp.siteId === filterSiteId;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'completed' ? fp.status === 'completed' : (fp.status === 'draft' || !fp.status));
    return matchesSearch && matchesSite && matchesStatus;
  });

  // Sort floor plans
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'recent') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (sortBy === 'oldest') return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    if (sortBy === 'name') return a.floorName.localeCompare(b.floorName);
    if (sortBy === 'area') return (b.plotLength * b.plotWidth) - (a.plotLength * a.plotWidth);
    return 0;
  });

  // Group by site
  const grouped: Record<string, FloorPlan[]> = {};
  for (const fp of filtered) {
    const key = fp.siteName || fp.siteId || 'No Site';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(fp);
  }

  // Dashboard Metrics (all from real DB)
  const totalPlansCount = floorPlans.length;
  const draftPlansCount = floorPlans.filter(p => p.status === 'draft' || !p.status).length;
  const completedPlansCount = floorPlans.filter(p => p.status === 'completed').length;
  const uniqueSitesWithPlans = new Set(floorPlans.map(p => p.siteId).filter(Boolean)).size;
  const recentlyEditedPlan = floorPlans[0];
  const lastModifiedFormatted = recentlyEditedPlan
    ? new Date(recentlyEditedPlan.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : '—';

  const handleDelete = async (fp: FloorPlan) => {
    if (!confirm(`Move "${fp.floorName}" to Recycle Bin?`)) return;
    const res = await softDeleteFloorPlan(user, fp.id);
    if (res.success) {
      onNotify(`"${fp.floorName}" moved to Recycle Bin`, 'info');
    } else {
      onNotify(res.error || 'Delete failed', 'error');
    }
  };

  const handleDuplicate = async (fp: FloorPlan) => {
    const res = await duplicateFloorPlan(user, fp.id);
    if (res.success && res.plan) {
      onNotify(`"${fp.floorName}" duplicated successfully`, 'success');
    } else {
      onNotify(res.error || 'Duplicate failed', 'error');
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const formatDimensions = (fp: FloorPlan) =>
    `${fp.plotLength} × ${fp.plotWidth} ${fp.unit === 'feet' ? 'ft' : fp.unit === 'inches' ? 'in' : fp.unit === 'meters' ? 'm' : 'cm'}`;

  // Import Plan from JSON file
  const handleImportPlanJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.floorName || !data.plotLength || !data.plotWidth) {
        throw new Error('Invalid floor plan file format: missing floorName, plotLength, or plotWidth.');
      }
      if (userSites.length === 0) {
        onNotify('Create a construction site first to import plans.', 'error');
        return;
      }
      const targetSite = userSites.find(s => s.id === data.siteId) || userSites[0];
      const res = await createFloorPlan(user, {
        buildingName: data.buildingName || targetSite.name,
        floorName: `${data.floorName} (Imported)`,
        siteId: targetSite.id,
        siteName: targetSite.name,
        plotLength: parseFloat(data.plotLength) || 40,
        plotWidth: parseFloat(data.plotWidth) || 30,
        unit: data.unit || 'feet',
        walls: data.walls || [],
        rooms: data.rooms || [],
        doors: data.doors || [],
        windows: data.windows || [],
        furniture: data.furniture || [],
        stairs: data.stairs || [],
        columns: data.columns || [],
        annotations: data.annotations || [],
        notes: data.notes,
        status: 'draft',
      });
      if (res.success && res.plan) {
        onNotify(`Floor plan "${res.plan.floorName}" imported successfully!`, 'success');
        onOpenEditor(res.plan.id);
      }
    } catch (err: any) {
      onNotify('Import failed: ' + err.message, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Launch Starter Template
  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;
    if (!templateSiteId) {
      onNotify('Please select an existing construction site for this template.', 'error');
      return;
    }
    const targetSite = userSites.find(s => s.id === templateSiteId);
    if (!targetSite) {
      onNotify('Selected construction site not found.', 'error');
      return;
    }

    const res = await createFloorPlan(user, {
      buildingName: targetSite.name,
      floorName: `${selectedTemplate.bhk} Plan`,
      siteId: targetSite.id,
      siteName: targetSite.name,
      plotLength: selectedTemplate.plotLength,
      plotWidth: selectedTemplate.plotWidth,
      unit: selectedTemplate.unit,
      walls: selectedTemplate.walls,
      rooms: selectedTemplate.rooms,
      doors: selectedTemplate.doors,
      windows: selectedTemplate.windows,
      furniture: selectedTemplate.furniture || [],
      notes: `Created from ${selectedTemplate.name} template`,
      status: 'draft',
    });

    if (res.success && res.plan) {
      onNotify(`Template "${selectedTemplate.name}" created successfully!`, 'success');
      setShowTemplatesModal(false);
      setSelectedTemplate(null);
      onOpenEditor(res.plan.id);
    } else {
      onNotify(res.error || 'Failed to create plan from template', 'error');
    }
  };

  return (
    <div className="floor-plan-list-view">
      {/* Hidden Import Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleImportPlanJson}
      />

      {/* Page Header */}
      <div className="fp-list-header">
        <div className="fp-list-title-row">
          <div className="fp-list-title-group">
            <div className="fp-list-icon">
              <PenTool size={24} />
            </div>
            <div>
              <h1 className="fp-list-title">Floor Plan Creator</h1>
              <p className="fp-list-subtitle">
                Architectural 2D layout design, multi-floor levels, and real-time CAD workspace
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowTemplatesModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              title="Browse starter floor plan templates"
            >
              <LayoutTemplate size={16} />
              <span>Templates</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => fileInputRef.current?.click()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              title="Import floor plan JSON file"
            >
              <Upload size={16} />
              <span>Import Plan</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              id="new-floor-plan-btn"
              onClick={() => setShowNewPlanModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={18} />
              <span>New Floor Plan</span>
            </button>
          </div>
        </div>

        {/* Real Database Dashboard Stats Row */}
        <div className="fp-dashboard-stats">
          <div className="fp-stat-card">
            <div className="fp-stat-icon-wrap" style={{ background: 'rgba(217, 119, 6, 0.12)', color: '#d97706' }}>
              <PenTool size={20} />
            </div>
            <div className="fp-stat-info">
              <span className="fp-stat-val">{totalPlansCount}</span>
              <span className="fp-stat-lbl">Total Plans</span>
            </div>
          </div>

          <div className="fp-stat-card">
            <div className="fp-stat-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
              <Clock size={20} />
            </div>
            <div className="fp-stat-info">
              <span className="fp-stat-val">{draftPlansCount}</span>
              <span className="fp-stat-lbl">Draft Plans</span>
            </div>
          </div>

          <div className="fp-stat-card">
            <div className="fp-stat-icon-wrap" style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#16a34a' }}>
              <CheckCircle2 size={20} />
            </div>
            <div className="fp-stat-info">
              <span className="fp-stat-val">{completedPlansCount}</span>
              <span className="fp-stat-lbl">Completed</span>
            </div>
          </div>

          <div className="fp-stat-card">
            <div className="fp-stat-icon-wrap" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#9333ea' }}>
              <Building2 size={20} />
            </div>
            <div className="fp-stat-info">
              <span className="fp-stat-val">{uniqueSitesWithPlans}</span>
              <span className="fp-stat-lbl">Sites Linked</span>
            </div>
          </div>

          <div className="fp-stat-card">
            <div className="fp-stat-icon-wrap" style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#0284c7' }}>
              <FileCheck size={20} />
            </div>
            <div className="fp-stat-info">
              <span className="fp-stat-val" style={{ fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {recentlyEditedPlan ? recentlyEditedPlan.floorName : 'None'}
              </span>
              <span className="fp-stat-lbl">Recently Edited</span>
            </div>
          </div>

          <div className="fp-stat-card">
            <div className="fp-stat-icon-wrap" style={{ background: 'rgba(234, 179, 8, 0.12)', color: '#ca8a04' }}>
              <Calendar size={20} />
            </div>
            <div className="fp-stat-info">
              <span className="fp-stat-val" style={{ fontSize: '1.1rem' }}>{lastModifiedFormatted}</span>
              <span className="fp-stat-lbl">Last Modified</span>
            </div>
          </div>
        </div>

        {/* Search, Filter, and Sort Bar */}
        <div className="fp-list-toolbar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="fp-list-search" style={{ flex: 1, minWidth: 200 }}>
            <Search size={16} className="fp-list-search-icon" />
            <input
              type="search"
              placeholder="Search by building, floor, or site..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="fp-list-search-input"
              id="floor-plan-search"
            />
          </div>

          {/* Filter Site */}
          <select
            value={filterSiteId}
            onChange={e => setFilterSiteId(e.target.value)}
            className="fp-list-site-filter"
            id="floor-plan-site-filter"
            style={{ minWidth: 150 }}
          >
            <option value="all">All Sites</option>
            {userSites.map(site => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>

          {/* Filter Status */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="fp-list-site-filter"
            id="floor-plan-status-filter"
            style={{ minWidth: 130 }}
          >
            <option value="all">All Statuses</option>
            <option value="draft">Drafts</option>
            <option value="completed">Completed</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="fp-list-site-filter"
            id="floor-plan-sort-select"
            style={{ minWidth: 150 }}
          >
            <option value="recent">Recently Updated</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name (A–Z)</option>
            <option value="area">Plot Area (Largest)</option>
          </select>

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', border: '1.5px solid var(--border-medium)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                padding: '7px 10px',
                background: viewMode === 'grid' ? 'var(--primary-light, #fef3c7)' : 'var(--bg-card)',
                color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
              title="Grid View"
            >
              <Grid size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                padding: '7px 10px',
                background: viewMode === 'list' ? 'var(--primary-light, #fef3c7)' : 'var(--bg-card)',
                color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
              title="List View"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="fp-list-content" style={{ marginTop: 20 }}>
        {floorPlans.length === 0 ? (
          <div className="fp-list-empty">
            <div className="fp-list-empty-icon">
              <Grid3x3 size={48} />
            </div>
            <h3>Create your first floor plan</h3>
            <p>
              Design architectural 2D floor plans linked directly to your construction sites.
              <br />
              Draw walls, customize rooms, configure multi-floor levels, and preview in real 3D.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowNewPlanModal(true)}
              >
                <Plus size={18} />
                <span>+ Create Floor Plan</span>
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowTemplatesModal(true)}
              >
                <LayoutTemplate size={18} />
                <span>Browse Templates</span>
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="fp-list-empty">
            <FolderOpen size={40} />
            <h3>No Results Found</h3>
            <p>No floor plans match your current search, site, or status filters.</p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => { setSearchQuery(''); setFilterSiteId('all'); setStatusFilter('all'); }}
              style={{ marginTop: 8 }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            {Object.entries(grouped).map(([siteKey, plans]) => (
              <div key={siteKey} className="fp-site-group">
                <div className="fp-site-group-header">
                  <Building2 size={16} />
                  <span>{siteKey}</span>
                  <span className="fp-site-group-count">{plans.length} plan{plans.length !== 1 ? 's' : ''}</span>
                </div>

                {viewMode === 'grid' ? (
                  <div className="fp-cards-grid">
                    {plans.map(fp => (
                      <div
                        key={fp.id}
                        className="fp-card"
                        role="article"
                        aria-label={`Floor plan: ${fp.floorName}`}
                      >
                        {/* Thumbnail or placeholder */}
                        <div
                          className="fp-card-thumbnail"
                          onClick={() => onOpenEditor(fp.id)}
                        >
                          {fp.thumbnailDataUrl ? (
                            <img
                              src={fp.thumbnailDataUrl}
                              alt={`${fp.floorName} thumbnail`}
                              className="fp-card-thumbnail-img"
                            />
                          ) : (
                            <div className="fp-card-thumbnail-placeholder">
                              <Grid3x3 size={32} />
                              <span>No Preview</span>
                            </div>
                          )}
                          <div className="fp-card-thumbnail-overlay">
                            <ExternalLink size={20} />
                            <span>Open Editor</span>
                          </div>
                          {/* Status Badge */}
                          <span
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: fp.status === 'completed' ? 'rgba(22, 163, 74, 0.9)' : 'rgba(217, 119, 6, 0.9)',
                              color: '#ffffff',
                              backdropFilter: 'blur(4px)',
                            }}
                          >
                            {fp.status === 'completed' ? 'Completed' : 'Draft'}
                          </span>
                        </div>

                        {/* Card Info */}
                        <div className="fp-card-body">
                          <div className="fp-card-header">
                            <h3 className="fp-card-floor-name">{fp.floorName}</h3>
                            <span className="fp-card-building-name">{fp.buildingName}</span>
                          </div>

                          <div className="fp-card-meta">
                            <span className="fp-card-meta-item">
                              <Ruler size={13} />
                              {formatDimensions(fp)}
                            </span>
                            <span className="fp-card-meta-item">
                              <Calendar size={13} />
                              Updated {formatDate(fp.updatedAt)}
                            </span>
                          </div>

                          <div className="fp-card-stats">
                            <span className="fp-card-stat">{fp.walls.length} walls</span>
                            <span className="fp-card-stat">{fp.rooms.length} rooms</span>
                            {fp.doors.length > 0 && <span className="fp-card-stat">{fp.doors.length} doors</span>}
                            {fp.floors && fp.floors.length > 1 && (
                              <span className="fp-card-stat" style={{ background: '#fef3c7', color: '#b45309' }}>
                                {fp.floors.length} levels
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="fp-card-actions">
                          <button
                            type="button"
                            className="fp-card-action-btn fp-card-action-edit"
                            onClick={() => onOpenEditor(fp.id)}
                            title="Open floor plan editor"
                            id={`edit-fp-${fp.id}`}
                          >
                            <Edit2 size={15} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className="fp-card-action-btn fp-card-action-dup"
                            onClick={() => handleDuplicate(fp)}
                            title="Duplicate floor plan"
                            id={`dup-fp-${fp.id}`}
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            type="button"
                            className="fp-card-action-btn fp-card-action-del"
                            onClick={() => handleDelete(fp)}
                            title="Move to Recycle Bin"
                            id={`del-fp-${fp.id}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Table List View */
                  <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 12, border: '1.5px solid var(--border-light)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1.5px solid var(--border-light)', textAlign: 'left' }}>
                          <th style={{ padding: '10px 14px' }}>Floor Name</th>
                          <th style={{ padding: '10px 14px' }}>Building</th>
                          <th style={{ padding: '10px 14px' }}>Dimensions</th>
                          <th style={{ padding: '10px 14px' }}>Elements</th>
                          <th style={{ padding: '10px 14px' }}>Status</th>
                          <th style={{ padding: '10px 14px' }}>Last Updated</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plans.map(fp => (
                          <tr key={fp.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-main)' }}>
                              <span style={{ cursor: 'pointer', color: 'var(--primary)' }} onClick={() => onOpenEditor(fp.id)}>
                                {fp.floorName}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{fp.buildingName}</td>
                            <td style={{ padding: '10px 14px' }}>{formatDimensions(fp)}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                              {fp.walls.length} walls, {fp.rooms.length} rooms
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: fp.status === 'completed' ? 'rgba(22, 163, 74, 0.15)' : 'rgba(217, 119, 6, 0.15)',
                                color: fp.status === 'completed' ? '#16a34a' : '#d97706',
                              }}>
                                {fp.status === 'completed' ? 'Completed' : 'Draft'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{formatDate(fp.updatedAt)}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                <button type="button" className="btn btn-outline btn-sm" onClick={() => onOpenEditor(fp.id)}>
                                  Edit
                                </button>
                                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleDuplicate(fp)} title="Duplicate">
                                  <Copy size={13} />
                                </button>
                                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleDelete(fp)} title="Delete" style={{ color: '#ef4444' }}>
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Starter Templates Modal */}
      {showTemplatesModal && (
        <div className="modal-overlay" onClick={() => setShowTemplatesModal(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: 'rgba(217, 119, 6, 0.15)', color: '#d97706',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <LayoutTemplate size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>Architectural Starter Templates</h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>
                    Select a ready-to-draw plan template with real CAD geometry
                  </p>
                </div>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowTemplatesModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: 20 }}>
              {/* Select target site */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label htmlFor="tpl-target-site">
                  Target Construction Site <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  id="tpl-target-site"
                  value={templateSiteId}
                  onChange={e => setTemplateSiteId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border-medium)' }}
                >
                  <option value="">-- Choose Construction Site --</option>
                  {userSites.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Template Cards */}
              <div className="fp-templates-grid">
                {STARTER_TEMPLATES.map(tpl => {
                  const isSelected = selectedTemplate?.id === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      className="fp-template-card"
                      onClick={() => setSelectedTemplate(tpl)}
                      style={{
                        borderColor: isSelected ? 'var(--primary)' : undefined,
                        background: isSelected ? 'rgba(217, 119, 6, 0.05)' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="fp-template-bhk-tag">{tpl.bhk}</span>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                          {tpl.plotLength} × {tpl.plotWidth} {tpl.unit === 'feet' ? 'ft' : 'm'}
                        </span>
                      </div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{tpl.name}</h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {tpl.description}
                      </p>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                        Includes {tpl.rooms.length} rooms, {tpl.walls.length} walls, {tpl.doors.length} doors
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border-light)' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowTemplatesModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedTemplate || !templateSiteId}
                onClick={handleApplyTemplate}
              >
                Use Template & Start Drawing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Floor Plan Setup Modal */}
      {showNewPlanModal && (
        <NewFloorPlanModal
          user={user}
          sites={userSites}
          defaultSiteId={filterSiteId !== 'all' ? filterSiteId : undefined}
          onOpenNewSiteModal={onOpenNewSiteModal}
          onClose={() => setShowNewPlanModal(false)}
          onCreated={(planId) => {
            setShowNewPlanModal(false);
            onOpenEditor(planId);
          }}
          onNotify={onNotify}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// New Floor Plan Setup Modal
// ─────────────────────────────────────────────────────────

interface NewFloorPlanModalProps {
  user: User;
  sites: Site[];
  defaultSiteId?: string;
  onOpenNewSiteModal?: () => void;
  onClose: () => void;
  onCreated: (planId: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const isValidPositiveNumber = (val: string): boolean => {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  // Strictly positive number (integer or decimal), rejects negative signs, letters, symbols
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return false;
  const num = parseFloat(trimmed);
  return !isNaN(num) && isFinite(num) && num > 0;
};

const NewFloorPlanModal: React.FC<NewFloorPlanModalProps> = ({
  user,
  sites,
  defaultSiteId,
  onOpenNewSiteModal,
  onClose,
  onCreated,
  onNotify,
}) => {
  // Determine initial site selection
  const getInitialSiteId = () => {
    if (defaultSiteId && sites.some(s => s.id === defaultSiteId)) {
      return defaultSiteId;
    }
    if (sites.length === 1) {
      return sites[0].id;
    }
    return '';
  };

  const [siteId, setSiteId] = useState<string>(getInitialSiteId);
  const initialSite = sites.find(s => s.id === (defaultSiteId || (sites.length === 1 ? sites[0].id : '')));
  const [buildingName, setBuildingName] = useState<string>(initialSite ? initialSite.name : '');
  const [hasCustomBuildingName, setHasCustomBuildingName] = useState(false);
  const [floorName, setFloorName] = useState('Ground Floor');
  const [plotLength, setPlotLength] = useState('');
  const [plotWidth, setPlotWidth] = useState('');
  const [unit, setUnit] = useState<FloorPlanUnit>('feet');
  const [northDirection, setNorthDirection] = useState<number>(0);
  const [numFloors, setNumFloors] = useState<number>(1);
  const [ceilingHeight, setCeilingHeight] = useState<string>('10');
  const [wallThickness, setWallThickness] = useState<string>('0.75');
  const [notes, setNotes] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({
    siteId: false,
    buildingName: false,
    floorName: false,
    plotLength: false,
    plotWidth: false,
  });

  const selectedSite = sites.find(s => s.id === siteId);

  // If siteId is empty and sites become available, auto-select if single site
  useEffect(() => {
    if (!siteId && sites.length === 1) {
      setSiteId(sites[0].id);
      if (!hasCustomBuildingName && !buildingName.trim()) {
        setBuildingName(sites[0].name);
      }
    }
  }, [sites, siteId, hasCustomBuildingName, buildingName]);

  const handleSiteChange = (newSiteId: string) => {
    setSiteId(newSiteId);
    setTouched(t => ({ ...t, siteId: true }));
    const newSite = sites.find(s => s.id === newSiteId);
    if (newSite && (!hasCustomBuildingName || !buildingName.trim())) {
      setBuildingName(newSite.name);
      setHasCustomBuildingName(false);
    }
  };

  // Field validation checks
  const isSiteValid = Boolean(siteId && selectedSite);
  const isBuildingNameValid = Boolean(buildingName.trim().length > 0);
  const isFloorNameValid = Boolean(floorName.trim().length > 0);
  const isPlotLengthValid = isValidPositiveNumber(plotLength);
  const isPlotWidthValid = isValidPositiveNumber(plotWidth);
  const isUnitValid = unit === 'feet' || unit === 'meters' || unit === 'inches' || unit === 'centimeters';

  const isFormValid =
    isSiteValid &&
    isBuildingNameValid &&
    isFloorNameValid &&
    isPlotLengthValid &&
    isPlotWidthValid &&
    isUnitValid;

  const handleCreatePlan = async (isDraftOnly = false) => {
    setError('');

    if (!isSiteValid || !selectedSite) {
      setError('Please select an existing construction site. Floor plans must belong to a site.');
      return;
    }
    if (!isBuildingNameValid) {
      setError('Building Name is required.');
      return;
    }
    if (!isFloorNameValid) {
      setError('Floor / Level Name is required.');
      return;
    }
    if (!isPlotLengthValid) {
      setError('Plot Length must be a positive number greater than 0.');
      return;
    }
    if (!isPlotWidthValid) {
      setError('Plot Width must be a positive number greater than 0.');
      return;
    }
    if (!isUnitValid) {
      setError('Measurement unit is required.');
      return;
    }

    const lenNum = parseFloat(plotLength.trim());
    const wNum = parseFloat(plotWidth.trim());
    const cHeight = parseFloat(ceilingHeight.trim()) || (unit === 'meters' ? 3 : 10);
    const wThick = parseFloat(wallThickness.trim()) || (unit === 'meters' ? 0.23 : 0.75);

    setLoading(true);
    try {
      // Build initial level(s)
      const initialLevels = [];
      const totalLevels = Math.min(10, Math.max(1, numFloors));
      const levelNames = ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor', 'Fourth Floor', 'Fifth Floor'];
      for (let i = 0; i < totalLevels; i++) {
        initialLevels.push({
          id: `lvl-${i}-${Date.now()}`,
          name: i === 0 ? floorName.trim() : (levelNames[i] || `Floor ${i}`),
          elevation: i * cHeight,
          walls: [],
          rooms: [],
          doors: [],
          windows: [],
          furniture: [],
          stairs: [],
          columns: [],
          annotations: [],
        });
      }

      const res = await createFloorPlan(user, {
        buildingName: buildingName.trim(),
        floorName: floorName.trim(),
        siteId: selectedSite.id,
        siteName: selectedSite.name,
        plotLength: lenNum,
        plotWidth: wNum,
        unit,
        ceilingHeight: cHeight,
        northRotation: northDirection,
        notes: notes.trim() || undefined,
        status: isDraftOnly ? 'draft' : 'draft',
        walls: [],
        rooms: [],
        doors: [],
        windows: [],
        furniture: [],
        stairs: [],
        columns: [],
        annotations: [],
        floors: initialLevels,
      });

      if (res.success && res.plan) {
        if (isDraftOnly) {
          onNotify(`Floor plan "${res.plan.floorName}" saved as draft!`, 'success');
          onClose();
        } else {
          onNotify(`Floor plan "${res.plan.floorName}" created successfully!`, 'success');
          onCreated(res.plan.id);
        }
      } else {
        setError(res.error || 'Failed to create floor plan.');
      }
    } catch (err: any) {
      setError(err.message || 'Unexpected error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-fp-modal-title"
    >
      <div
        className="modal-dialog"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 540,
          width: '100%',
          maxHeight: 'min(88vh, 720px)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* Sticky Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: 'rgba(217, 119, 6, 0.15)',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <PenTool size={18} />
            </div>
            <div>
              <h3 id="new-fp-modal-title" style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>
                New Floor Plan
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>
                Set up architectural specifications to begin drawing
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Container with scrollable body and pinned footer */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleCreatePlan(false); }}
          className="modal-form-container"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 auto',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Scrollable Body */}
          <div
            className="modal-body"
            style={{
              overflowY: 'auto',
              flex: '1 1 auto',
              minHeight: 0,
              maxHeight: 'calc(min(88vh, 720px) - 130px)',
              padding: '18px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {error && (
              <div className="alert-error" style={{ marginBottom: 4 }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            {/* If user has no sites */}
            {sites.length === 0 ? (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: '#fffbeb',
                  border: '1.5px solid #fde68a',
                  color: '#92400e',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.92rem' }}>
                  <AlertCircle size={20} color="#d97706" style={{ flexShrink: 0 }} />
                  <span>No construction sites found.</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#b45309', margin: 0, lineHeight: 1.4 }}>
                  Create a construction site first to create a floor plan. Every floor plan must belong to an existing Building Mistry site.
                </p>
                {onOpenNewSiteModal && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      onClose();
                      onOpenNewSiteModal();
                    }}
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    id="new-fp-create-site-btn"
                  >
                    <Plus size={16} />
                    <span>Create Construction Site</span>
                  </button>
                )}
              </div>
            ) : (
              /* Construction Site Required */
              <div className="form-group">
                <label htmlFor="new-fp-site">
                  Construction Site <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  id="new-fp-site"
                  value={siteId}
                  onChange={e => handleSiteChange(e.target.value)}
                  onBlur={() => setTouched(t => ({ ...t, siteId: true }))}
                  required
                >
                  <option value="" disabled>-- Select Construction Site * --</option>
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {touched.siteId && !siteId && (
                  <span style={{ color: '#ef4444', fontSize: '0.78rem' }}>
                    Please select a construction site
                  </span>
                )}
              </div>
            )}

            {/* Building Name */}
            <div className="form-group">
              <label htmlFor="new-fp-building">
                Building Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="new-fp-building"
                type="text"
                placeholder="e.g. Raman Villa, Block A"
                value={buildingName}
                onChange={e => {
                  setBuildingName(e.target.value);
                  setHasCustomBuildingName(true);
                }}
                onBlur={() => setTouched(t => ({ ...t, buildingName: true }))}
                required
              />
              {touched.buildingName && !buildingName.trim() && (
                <span style={{ color: '#ef4444', fontSize: '0.78rem' }}>
                  Building Name is required
                </span>
              )}
            </div>

            {/* Floor / Level Name */}
            <div className="form-group">
              <label htmlFor="new-fp-floor">
                Floor / Level Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="new-fp-floor"
                type="text"
                placeholder="e.g. Ground Floor, First Floor"
                value={floorName}
                onChange={e => setFloorName(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, floorName: true }))}
                required
              />
              {touched.floorName && !floorName.trim() && (
                <span style={{ color: '#ef4444', fontSize: '0.78rem' }}>
                  Floor / Level Name is required
                </span>
              )}
            </div>

            {/* Plot Dimensions */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                width: '100%',
              }}
            >
              <div className="form-group">
                <label htmlFor="new-fp-length">
                  Plot Length <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="new-fp-length"
                  type="number"
                  min="0.01"
                  step="any"
                  placeholder="e.g. 40"
                  value={plotLength}
                  onChange={e => setPlotLength(e.target.value)}
                  onBlur={() => setTouched(t => ({ ...t, plotLength: true }))}
                  required
                />
                {plotLength !== '' && !isPlotLengthValid && (
                  <span style={{ color: '#ef4444', fontSize: '0.78rem' }}>
                    Must be a positive number greater than 0
                  </span>
                )}
                {touched.plotLength && plotLength === '' && (
                  <span style={{ color: '#ef4444', fontSize: '0.78rem' }}>
                    Plot Length is required
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="new-fp-width">
                  Plot Width <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="new-fp-width"
                  type="number"
                  min="0.01"
                  step="any"
                  placeholder="e.g. 30"
                  value={plotWidth}
                  onChange={e => setPlotWidth(e.target.value)}
                  onBlur={() => setTouched(t => ({ ...t, plotWidth: true }))}
                  required
                />
                {plotWidth !== '' && !isPlotWidthValid && (
                  <span style={{ color: '#ef4444', fontSize: '0.78rem' }}>
                    Must be a positive number greater than 0
                  </span>
                )}
                {touched.plotWidth && plotWidth === '' && (
                  <span style={{ color: '#ef4444', fontSize: '0.78rem' }}>
                    Plot Width is required
                  </span>
                )}
              </div>
            </div>

            {/* Large plot dimensions notice without changing user values */}
            {((parseFloat(plotLength) > 500 && isPlotLengthValid) || (parseFloat(plotWidth) > 500 && isPlotWidthValid)) && (
              <div style={{
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(217, 119, 6, 0.08)',
                border: '1px solid rgba(217, 119, 6, 0.25)',
                color: '#b45309',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>Large plot dimensions entered. Canvas scale will automatically adjust to fit your full plot boundary.</span>
              </div>
            )}

            {/* Measurement Unit */}
            <div className="form-group">
              <label htmlFor="new-fp-unit">
                Measurement Unit <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="new-fp-unit"
                value={unit}
                onChange={e => setUnit(e.target.value as FloorPlanUnit)}
                required
              >
                <option value="feet">Feet (ft)</option>
                <option value="inches">Inches (in)</option>
                <option value="meters">Meters (m)</option>
                <option value="centimeters">Centimeters (cm)</option>
              </select>
            </div>

            {/* Advanced Architectural Options Toggle */}
            <div style={{ marginTop: 2 }}>
              <button
                type="button"
                onClick={() => setShowAdvanced(a => !a)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {showAdvanced ? '− Hide Optional Specifications' : '+ Show Optional Specifications (North, Floors, Ceiling, Walls)'}
              </button>
            </div>

            {showAdvanced && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 14,
                borderRadius: 10,
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-light)',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label htmlFor="new-fp-north">North Direction</label>
                    <select
                      id="new-fp-north"
                      value={northDirection}
                      onChange={e => setNorthDirection(parseInt(e.target.value) || 0)}
                    >
                      <option value={0}>0° (Facing Up / North)</option>
                      <option value={90}>90° (Facing Right / East)</option>
                      <option value={180}>180° (Facing Down / South)</option>
                      <option value={270}>270° (Facing Left / West)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="new-fp-floors">Number of Floors</label>
                    <input
                      id="new-fp-floors"
                      type="number"
                      min={1}
                      max={10}
                      value={numFloors}
                      onChange={e => setNumFloors(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label htmlFor="new-fp-ceiling">Ceiling Height ({unit === 'meters' || unit === 'centimeters' ? 'm' : 'ft'})</label>
                    <input
                      id="new-fp-ceiling"
                      type="number"
                      step="0.5"
                      value={ceilingHeight}
                      onChange={e => setCeilingHeight(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="new-fp-wall-thick">Wall Thickness ({unit === 'meters' || unit === 'centimeters' ? 'm' : 'ft'})</label>
                    <input
                      id="new-fp-wall-thick"
                      type="number"
                      step="0.05"
                      value={wallThickness}
                      onChange={e => setWallThickness(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="form-group">
              <label htmlFor="new-fp-notes">Notes (optional)</label>
              <textarea
                id="new-fp-notes"
                rows={2}
                placeholder="Any architectural notes or site specifications..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Action Footer: Always Visible & Sticky Pinned */}
          <div
            className="modal-footer"
            style={{
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 10,
              padding: '14px 20px',
              borderTop: '1.5px solid #e2e8f0',
              backgroundColor: '#ffffff',
              position: 'sticky',
              bottom: 0,
              zIndex: 10,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={loading}
              id="new-fp-cancel-btn"
              style={{ minWidth: 80, minHeight: 44 }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => handleCreatePlan(true)}
              disabled={!isFormValid || loading}
              id="new-fp-draft-btn"
              style={{ minWidth: 110, minHeight: 44 }}
            >
              Save Draft
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isFormValid || loading}
              id="create-fp-submit-btn"
              style={{ minWidth: 200, minHeight: 44 }}
            >
              {loading ? 'Creating...' : 'Create & Start Drawing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
