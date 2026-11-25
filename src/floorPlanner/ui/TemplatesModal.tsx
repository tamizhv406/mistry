import { useEffect, useState } from 'react';
import { X, Layers, Check } from 'lucide-react';
import {
  HOUSE_TEMPLATES,
  HOUSE_TEMPLATE_TYPES,
  cloneTemplateFloorPlan,
  roomSizeText,
  templateSizeText,
  type HouseTemplate,
  type HouseTemplateType,
} from '../../domain/houseTemplates';
import { HouseTemplatePreview } from '../../components/floorplan/HouseTemplatePreview';
import { usePlanStore } from '../store/planStore';
import { showToast } from './Toast';

/**
 * House templates inside the planner: loads a copy of one floor of a template into the plan
 * that is open (it then saves like any drawing). A Duplex has a button per floor; to get both
 * floors as separate plans, start from the template in the Floor Planner list instead.
 */
export function TemplatesModal({ onClose }: { onClose: () => void }) {
  const [filter, setFilter] = useState<'All' | HouseTemplateType>('All');
  const [pending, setPending] = useState<{ id: string; floor: number } | null>(null);
  const currentPlan = usePlanStore((s) => s.plan);
  const hasDrawing = !!currentPlan && currentPlan.walls.length > 0;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const templates = filter === 'All' ? HOUSE_TEMPLATES : HOUSE_TEMPLATES.filter((t) => t.type === filter);

  const apply = (t: HouseTemplate, floorIndex: number) => {
    // Keep the name the user gave this plan; a fresh blank plan takes the template's name.
    const keepName = currentPlan?.name && !/^New (Blank Plan|floor plan)$/i.test(currentPlan.name) ? currentPlan.name : undefined;
    const plan = cloneTemplateFloorPlan(t, floorIndex, keepName && t.floors.length === 1 ? keepName : undefined);
    if (keepName && t.floors.length > 1) plan.name = `${keepName} – ${t.floors[floorIndex].label}`;
    const store = usePlanStore.getState();
    store.loadPlan(plan, { fit: true });
    store.setTool('select');
    showToast(`Loaded ${t.title}${t.floors.length > 1 ? ` – ${t.floors[floorIndex].label}` : ''}. Every wall, door, window and room can be edited.`);
    onClose();
  };
  const choose = (t: HouseTemplate, floorIndex: number) => {
    if (hasDrawing) setPending({ id: t.id, floor: floorIndex });
    else apply(t, floorIndex);
  };

  return (
    <div className="fp-tpl-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fp-tpl-dialog" role="dialog" aria-modal="true" aria-labelledby="fp-tpl-title">
        <div className="fp-tpl-head">
          <div>
            <h2 id="fp-tpl-title" className="fp-tpl-title">
              <Layers size={20} color="#F97316" aria-hidden />
              <span>House Templates</span>
            </h2>
            <p className="fp-tpl-sub">Pick a 1 BHK, 2 BHK, 3 BHK or Duplex layout, then change any wall, door, window or room.</p>
          </div>
          <button type="button" className="fp-tpl-close" onClick={onClose} aria-label="Close templates">
            <X size={20} />
          </button>
        </div>

        <div className="fp-tpl-filters" role="group" aria-label="Filter house templates">
          {HOUSE_TEMPLATE_TYPES.map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={filter === category}
              className={`fp-tpl-chip${filter === category ? ' is-active' : ''}`}
              onClick={() => setFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="fp-tpl-body">
          <div className="fp-tpl-grid">
            {templates.map((t) => (
              <article key={t.id} className="fp-tpl-card">
                <div className="fp-tpl-preview">
                  <HouseTemplatePreview template={t} height={170} />
                </div>
                <div className="fp-tpl-badges">
                  <span className="fp-tpl-badge">{t.type}</span>
                  {t.floors.length > 1 && <span className="fp-tpl-badge is-charcoal">G + 1</span>}
                </div>
                <h3 className="fp-tpl-card-title">{t.title}</h3>
                <p className="fp-tpl-card-meta">{templateSizeText(t)}</p>
                <p className="fp-tpl-card-desc">{t.roomSummary}</p>
                <details className="fp-tpl-rooms">
                  <summary>Rooms and sizes</summary>
                  <ul>
                    {t.rooms.map((r) => (
                      <li key={`${r.floorIndex}-${r.id}`}>
                        <span>{t.floors.length > 1 ? `${r.name} (${r.floorIndex === 0 ? 'GF' : 'FF'})` : r.name}</span>
                        <span>{roomSizeText(r)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
                {pending?.id === t.id ? (
                  <div className="fp-tpl-confirm" role="alert">
                    <p>Replace the current drawing with this {t.floors.length > 1 ? t.floors[pending.floor].label.toLowerCase() : 'plan'}?</p>
                    <div className="fp-tpl-actions">
                      <button type="button" className="fp-tpl-apply" onClick={() => apply(t, pending.floor)}>Replace</button>
                      <button type="button" className="fp-tpl-secondary" onClick={() => setPending(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="fp-tpl-actions">
                    {t.floors.map((f) => (
                      <button key={f.floorIndex} type="button" className="fp-tpl-apply" onClick={() => choose(t, f.floorIndex)}>
                        <Check size={16} aria-hidden />
                        <span>{t.floors.length > 1 ? `Use ${f.label}` : 'Use Template'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
