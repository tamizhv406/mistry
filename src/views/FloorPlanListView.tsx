import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Box, ChevronDown, ChevronUp, LayoutTemplate, Pencil, PenTool, Plus, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { FloorPlan, Site, User } from '../db/types';
import {
  HOUSE_TEMPLATES,
  HOUSE_TEMPLATE_TYPES,
  roomSizeText,
  templateSizeText,
  type HouseTemplate,
  type HouseTemplateType,
} from '../domain/houseTemplates';
import { HouseTemplatePreview } from '../components/floorplan/HouseTemplatePreview';
import {
  createPlannerRecord,
  createRecordsFromTemplate,
  isPlannerRecord,
  listFloorPlans,
  planCounts,
  plotText,
  renamePlannerRecord,
} from '../services/floorPlannerRecords';

interface FloorPlanListViewProps {
  user: User;
  initialSiteId?: string | null;
  onBack: () => void;
  onOpenPlan: (planId: string) => void;
  onTrashPlan: (plan: FloorPlan) => void;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const when = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export function FloorPlanListView({ user, initialSiteId, onBack, onOpenPlan, onTrashPlan, onNotify }: FloorPlanListViewProps) {
  const [siteFilter, setSiteFilter] = useState<string>(initialSiteId || '');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFloor, setNewFloor] = useState('Ground Floor');
  const [newSiteId, setNewSiteId] = useState<string>(initialSiteId || '');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTemplates, setShowTemplates] = useState<boolean | null>(null);
  const [templateFilter, setTemplateFilter] = useState<'All' | HouseTemplateType>('All');

  useEffect(() => {
    setSiteFilter(initialSiteId || '');
    setNewSiteId(initialSiteId || '');
  }, [initialSiteId]);

  const sites = useLiveQuery(() => db.getSitesForUser(user), [user]) || [];
  const plans = useLiveQuery(() => listFloorPlans(user, siteFilter || null), [user, siteFilter]);
  const siteName = (id?: string) => (id ? sites.find((s: Site) => s.id === id)?.name : undefined);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const site = sites.find((s: Site) => s.id === newSiteId) || null;
      const name = newName.trim() || (site ? `${site.name} plan` : 'New floor plan');
      const record = await createPlannerRecord(user, { name, floorName: newFloor, site });
      setCreating(false);
      setNewName('');
      onOpenPlan(record.id);
    } catch (err: any) {
      onNotify('Could not create the plan: ' + (err?.message || err), 'error');
    } finally {
      setBusy(false);
    }
  };

  // Templates open by default until the first plan exists.
  const templatesOpen = showTemplates ?? (plans ? plans.length === 0 : false);
  const shownTemplates = templateFilter === 'All' ? HOUSE_TEMPLATES : HOUSE_TEMPLATES.filter(t => t.type === templateFilter);

  const startFromTemplate = async (template: HouseTemplate) => {
    if (busy) return;
    setBusy(true);
    try {
      const site = sites.find((s: Site) => s.id === siteFilter) || null;
      const created = await createRecordsFromTemplate(user, template, { site });
      onNotify(
        created.length > 1
          ? `${template.title}: Ground Floor and First Floor plans created. Opening the Ground Floor.`
          : `${template.title} created. Every wall, door, window and room can be changed.`,
        'success'
      );
      onOpenPlan(created[0].id);
    } catch (err: any) {
      onNotify('Could not create the plan: ' + (err?.message || err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveName = async (plan: FloorPlan) => {
    if (!renaming) return;
    const name = renaming.name.trim();
    setRenaming(null);
    if (!name || name === plan.buildingName) return;
    try {
      await renamePlannerRecord(plan, name);
    } catch (err: any) {
      onNotify('Could not rename the plan: ' + (err?.message || err), 'error');
    }
  };

  return (
    <div className="main-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button className="btn btn-outline btn-sm" onClick={onBack} style={{ marginBottom: 8 }}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <PenTool size={26} color="var(--primary)" />
            Floor Planner
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: 620 }}>
            Draw walls, doors and windows to scale, place furniture, see the house in 3D, put it on the map,
            plan wiring, water, drainage and floor heating, and get a bill of materials.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} />
          <span>New floor plan</span>
        </button>
      </div>

      {creating && (
        <div style={{ padding: 16, marginBottom: 20, display: 'grid', gap: 12, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>New floor plan</h3>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Plan name</label>
              <input
                autoFocus
                value={newName}
                placeholder="e.g. Murugan house"
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') void create();
                }}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Floor</label>
              <input value={newFloor} onChange={e => setNewFloor(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Site</label>
              <select value={newSiteId} onChange={e => setNewSiteId(e.target.value)}>
                <option value="">No site</option>
                {sites.map((s: Site) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => void create()} disabled={busy}>
              <PenTool size={16} />
              <span>Create and open</span>
            </button>
          </div>
        </div>
      )}

      <section className="tpl-section" aria-labelledby="tpl-section-title">
        <div className="tpl-section-head">
          <div>
            <h3 id="tpl-section-title" className="tpl-section-title">
              <LayoutTemplate size={20} aria-hidden="true" /> Start from a house template
            </h3>
            <p className="tpl-section-sub">Ready 1 BHK, 2 BHK, 3 BHK and Duplex plans for 20×30, 30×40 and 30×50 ft plots. Change anything after opening.</p>
          </div>
          <button
            type="button"
            className="tpl-toggle"
            aria-expanded={templatesOpen}
            aria-controls="tpl-section-body"
            onClick={() => setShowTemplates(!templatesOpen)}
          >
            {templatesOpen ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
            <span>{templatesOpen ? 'Hide templates' : 'Show templates'}</span>
          </button>
        </div>
        {templatesOpen && (
          <div id="tpl-section-body">
            <div className="tpl-filter-bar" role="group" aria-label="Filter house templates">
              {HOUSE_TEMPLATE_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  className={`tpl-filter-chip${templateFilter === type ? ' is-active' : ''}`}
                  aria-pressed={templateFilter === type}
                  onClick={() => setTemplateFilter(type)}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="tpl-grid">
              {shownTemplates.map(t => (
                <article key={t.id} className="tpl-card">
                  <HouseTemplatePreview template={t} height={180} />
                  <div className="tpl-badges">
                    <span className="tpl-badge">{t.type}</span>
                    {t.floors.length > 1 && <span className="tpl-badge is-charcoal">Ground + First Floor</span>}
                  </div>
                  <h4 className="tpl-card-title">{t.title}</h4>
                  <p className="tpl-card-size">{templateSizeText(t)}</p>
                  <p className="tpl-card-meta">{t.roomSummary}</p>
                  <details className="tpl-rooms">
                    <summary>Rooms and sizes</summary>
                    <ul>
                      {t.rooms.map(r => (
                        <li key={`${r.floorIndex}-${r.id}`}>
                          <span>{t.floors.length > 1 ? `${r.name} (${r.floorIndex === 0 ? 'GF' : 'FF'})` : r.name}</span>
                          <span>{roomSizeText(r)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                  <button type="button" className="tpl-use-btn" disabled={busy} onClick={() => void startFromTemplate(t)}>
                    <PenTool size={16} aria-hidden="true" />
                    <span>{t.floors.length > 1 ? 'Use template (2 floors)' : 'Use template'}</span>
                  </button>
                </article>
              ))}
            </div>
            <p className="tpl-note">
              {siteFilter && siteName(siteFilter) ? `New plans go to ${siteName(siteFilter)}.` : 'Pick a site above the list first if the plan belongs to one.'} Room sizes are centre-line; the planner shows the carpet area inside the walls.
            </p>
          </div>
        )}
      </section>

      {sites.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Site</span>
          <select
           
            style={{ maxWidth: 280 }}
            value={siteFilter}
            onChange={e => setSiteFilter(e.target.value)}
          >
            <option value="">All sites</option>
            {sites.map((s: Site) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!plans ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading plans…</p>
      ) : plans.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
          <PenTool size={40} style={{ color: '#94A3B8', margin: '0 auto 12px' }} />
          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>No floor plans yet</h4>
          <p style={{ fontSize: '0.85rem', color: '#64748B', maxWidth: 440, margin: '0 auto 16px' }}>
            Start a plan for a site and draw it to scale in feet and inches.
          </p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} />
            <span>New floor plan</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {plans.map(plan => {
            const legacy = !isPlannerRecord(plan);
            const counts = planCounts(plan);
            const plot = plotText(plan);
            const site = plan.siteName || siteName(plan.siteId);
            return (
              <div
                key={plan.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  padding: 16,
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge-planning" style={{ fontSize: '0.7rem' }}>
                    {plan.floorName || 'Ground Floor'}
                  </span>
                  {legacy && (
                    <span className="badge" style={{ fontSize: '0.7rem', background: '#FEF3C7', color: '#92400E' }}>
                      Old planner
                    </span>
                  )}
                </div>

                {renaming?.id === plan.id ? (
                  <input
                    autoFocus
                    value={renaming.name}
                    onChange={e => setRenaming({ id: plan.id, name: e.target.value })}
                    onBlur={() => void saveName(plan)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') void saveName(plan);
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                  />
                ) : (
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: 0 }}>
                    {plan.buildingName || 'Floor plan'}
                  </h4>
                )}

                <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0 }}>
                  {[site, plot && `Plot ${plot}`, `${counts.walls} walls`, `${counts.openings} doors & windows`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p style={{ fontSize: '0.72rem', color: '#94A3B8', margin: 0 }}>Updated {when(plan.updatedAt)}</p>

                {legacy && (
                  <p style={{ fontSize: '0.75rem', color: '#92400E', margin: 0 }}>
                    Made with the earlier planner. Its data is kept, but the new planner cannot open it.
                  </p>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
                  {!legacy && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => onOpenPlan(plan.id)}
                    >
                      <Box size={14} />
                      <span>Open</span>
                      <ArrowRight size={14} />
                    </button>
                  )}
                  {!legacy && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      aria-label="Rename plan"
                      title="Rename"
                      onClick={() => setRenaming({ id: plan.id, name: plan.buildingName || '' })}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    aria-label="Move plan to Recycle Bin"
                    title="Move to Recycle Bin"
                    style={legacy ? { flex: 1, justifyContent: 'center' } : undefined}
                    onClick={() => onTrashPlan(plan)}
                  >
                    <Trash2 size={14} />
                    {legacy && <span>Move to Recycle Bin</span>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
