import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Camera, ChevronRight, Minus, Pencil, Plus, Wrench } from 'lucide-react';
import { db } from '../../db/db';
import type { CatalogItem, ToolAsset, ToolCondition, ToolIssue, User } from '../../db/types';
import { useProject } from '../../hooks/useProject';
import { TOOL_CATEGORIES } from '../../domain/catalog';
import { buildToolStatus, isOverdue, outstandingQuantity, TOOL_CONDITIONS, type ToolStatus } from '../../domain/toolTracking';
import { ensureCatalogSeeded, issueTool, returnTool, saveToolAsset } from '../../services/records';
import { formatDateTime, formatDay, todayKey } from '../../utils/datetime';
import { Badge, Chips, Empty, Field, Loading, Note, Page, SearchBox, Section, Segmented, Sheet, Stat } from '../../components/mobile/kit';

type Tab = 'tools' | 'issued' | 'catalog';

/** Bundled photos are stored relative to the app base; user photos are data URLs. */
const photoSrc = (url?: string) => (url ? (url.startsWith('data:') || url.startsWith('http') ? url : `./${url}`) : undefined);

const ToolPhoto: React.FC<{ url?: string; alt: string; className: string }> = ({ url, alt, className }) => {
  const [failed, setFailed] = useState(false);
  const src = photoSrc(url);
  if (!src || failed) {
    return <div className={`${className} ${className === 'm-thumb' ? 'm-thumb-empty' : 'm-tool-photo-empty'}`} role="img" aria-label={`${alt} (no photo)`}><Wrench size={className === 'm-thumb' ? 22 : 34} /></div>;
  }
  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
};

const Stepper: React.FC<{ value: number; min?: number; max: number; onChange: (n: number) => void; label: string; hideMax?: boolean }> = ({ value, min = 1, max, onChange, label, hideMax }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} role="group" aria-label={label}>
    <button type="button" className="m-icon-btn is-bordered" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Decrease"><Minus size={20} /></button>
    <input
      type="text"
      inputMode="numeric"
      value={String(value)}
      onChange={e => {
        const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
        onChange(Number.isNaN(n) ? min : Math.min(Math.max(n, min), Math.max(min, max)));
      }}
      style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.15rem', maxWidth: 96 }}
      aria-label={label}
    />
    <button type="button" className="m-icon-btn is-bordered" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Increase"><Plus size={20} /></button>
    {!hideMax && <span className="is-muted" style={{ fontSize: '0.86rem' }}>of {max}</span>}
  </div>
);

/** Reads a photo from the device and shrinks it to a 480x360 JPEG so it stores small. */
async function fileToPhoto(file: File): Promise<string> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = bitmapUrl;
    await img.decode();
    const W = 480, H = 360;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process the photo.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    const scale = Math.max(W / img.width, H / img.height);
    ctx.drawImage(img, (W - img.width * scale) / 2, (H - img.height * scale) / 2, img.width * scale, img.height * scale);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

interface ToolRoomViewProps {
  user: User;
  siteId: string;
  onBack: () => void;
  onOpenLedger: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ToolRoomView: React.FC<ToolRoomViewProps> = ({ user, siteId, onBack, onOpenLedger, onNotify }) => {
  const project = useProject(siteId);
  const catalog = useLiveQuery(() => db.catalogItems.filter(c => !c.isDeleted && c.kind === 'tool').toArray(), []);
  const [tab, setTab] = useState<Tab>('tools');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [openToolId, setOpenToolId] = useState<string | null>(null);
  const [issueFor, setIssueFor] = useState<ToolAsset | null>(null);
  const [returnFor, setReturnFor] = useState<ToolIssue | null>(null);
  const [edit, setEdit] = useState<{ tool?: ToolAsset; from?: CatalogItem } | null>(null);

  useEffect(() => {
    ensureCatalogSeeded().catch(() => onNotify('Could not load the tool catalog.', 'error'));
    // Seed once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statuses = useMemo(() => {
    const map = new Map<string, ToolStatus>();
    if (project) for (const t of project.toolAssets) map.set(t.id, buildToolStatus(t, project.toolIssues));
    return map;
  }, [project]);

  if (project === undefined) return <Page title="Tools" onBack={onBack}><Loading rows={4} /></Page>;
  if (project === null) return <Page title="Tools" onBack={onBack}><div className="m-card"><Empty icon={<Wrench size={26} />} title="Project not found" /></div></Page>;

  const today = todayKey();
  const tools = project.toolAssets;
  const toolById = new Map(tools.map(t => [t.id, t]));
  const openIssues = project.toolIssues
    .filter(i => outstandingQuantity(i) > 0 && toolById.has(i.toolAssetId))
    .sort((a, b) => (a.expectedReturnDate || '9999').localeCompare(b.expectedReturnDate || '9999') || b.issuedAt.localeCompare(a.issuedAt));
  const outNow = openIssues.reduce((s, i) => s + outstandingQuantity(i), 0);
  const overdue = openIssues.filter(i => isOverdue(i, today)).length;

  const q = query.trim().toLowerCase();
  const usedCategories = Array.from(new Set(tools.map(t => t.category)));
  const shownTools = tools.filter(t => (category === 'all' || t.category === category) && (!q || t.name.toLowerCase().includes(q)));
  const ownedCatalogIds = new Set(tools.map(t => t.catalogItemId).filter(Boolean));
  const catalogCategories = Array.from(new Set([...TOOL_CATEGORIES, ...(catalog || []).map(c => c.category)]));
  const openTool = openToolId ? toolById.get(openToolId) : undefined;
  const openStatus = openTool ? statuses.get(openTool.id) : undefined;

  return (
    <Page title="Tools" subtitle={project.site.name} onBack={onBack}>
      <div className="m-stats is-3">
        <Stat label="Tools" value={tools.reduce((s, t) => s + t.totalQuantity, 0)} hint={`${tools.length} kind${tools.length === 1 ? '' : 's'}`} />
        <Stat label="Out now" value={outNow} tone={outNow ? 'warn' : undefined} hint="issued" onClick={() => setTab('issued')} />
        <Stat label="Overdue" value={overdue} tone={overdue ? 'bad' : 'ok'} hint="to return" onClick={() => setTab('issued')} />
      </div>

      <div style={{ marginTop: 12 }}>
        <Segmented
          label="View"
          value={tab}
          onChange={setTab}
          options={[{ value: 'tools', label: 'My tools' }, { value: 'issued', label: `Issued (${openIssues.length})` }, { value: 'catalog', label: 'Catalog' }]}
        />
      </div>

      {tab === 'tools' && (
        tools.length === 0 ? (
          <div className="m-card" style={{ marginTop: 14 }}>
            <Empty
              icon={<Wrench size={26} />}
              title="No tools added yet"
              action={<button type="button" className="m-btn is-primary" onClick={() => setTab('catalog')}><Plus size={20} /> Add from catalog</button>}
            >
              Add the tools kept at this site. Then issue them to workers and record when they come back.
            </Empty>
          </div>
        ) : (
          <>
            {tools.length > 6 && <div style={{ marginTop: 12 }}><SearchBox value={query} onChange={setQuery} placeholder="Search tools" /></div>}
            {usedCategories.length > 1 && (
              <div style={{ marginTop: 10 }}>
                <Chips label="Category" value={category} onChange={setCategory} options={[{ value: 'all', label: 'All' }, ...usedCategories.map(c => ({ value: c, label: c }))]} />
              </div>
            )}
            <div className="m-tool-grid" style={{ marginTop: 12 }}>
              {shownTools.map(t => {
                const st = statuses.get(t.id)!;
                return (
                  <button key={t.id} type="button" className="m-card m-tool-card" onClick={() => setOpenToolId(t.id)}>
                    <ToolPhoto url={t.imageUrl} alt={t.name} className="m-tool-photo" />
                    <div className="m-tool-body">
                      <div className="m-tool-name">{t.name}</div>
                      <div className="m-tool-counts">
                        <Badge tone={st.available > 0 ? 'ok' : 'bad'}>{st.available} available</Badge>
                        {st.issued > 0 && <Badge tone="warn">{st.issued} out</Badge>}
                        {t.condition !== 'Good' && <Badge tone="bad">{t.condition}</Badge>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {shownTools.length === 0 && <p className="is-muted" style={{ padding: 16 }}>No tool matches your search.</p>}
          </>
        )
      )}

      {tab === 'issued' && (
        openIssues.length === 0 ? (
          <div className="m-card" style={{ marginTop: 14 }}><Empty icon={<Wrench size={26} />} title="Nothing is out">Every issued tool has been returned.</Empty></div>
        ) : (
          <div className="m-card m-list" style={{ marginTop: 12 }}>
            {openIssues.map(i => {
              const t = toolById.get(i.toolAssetId)!;
              const late = isOverdue(i, today);
              return (
                <button key={i.id} type="button" className="m-row" onClick={() => setReturnFor(i)}>
                  <ToolPhoto url={t.imageUrl} alt={t.name} className="m-thumb" />
                  <span className="m-row-main">
                    <span className="m-row-title" style={{ display: 'block' }}>{outstandingQuantity(i)} × {t.name}</span>
                    <span className="m-row-sub" style={{ display: 'block' }}>With {i.issuedTo} · since {formatDateTime(i.issuedAt)}</span>
                    <span style={{ display: 'inline-flex', marginTop: 4 }}>
                      {late ? <Badge tone="bad"><AlertTriangle size={12} /> Due {formatDay(i.expectedReturnDate)}</Badge>
                        : i.expectedReturnDate ? <Badge>Due {formatDay(i.expectedReturnDate)}</Badge>
                        : <Badge>No return date</Badge>}
                    </span>
                  </span>
                  <span className="m-link" aria-hidden="true">Return</span>
                </button>
              );
            })}
          </div>
        )
      )}

      {tab === 'catalog' && (
        <>
          <p className="m-calc-note" style={{ marginTop: 12 }}>Tap a tool to add it to this project. You can also add any tool of your own.</p>
          <button type="button" className="m-btn is-block" style={{ marginTop: 6 }} onClick={() => setEdit({})}><Plus size={20} /> Add a tool that is not listed</button>
          {catalogCategories.map(cat => {
            const rows = (catalog || []).filter(c => c.category === cat).sort((a, b) => a.name.localeCompare(b.name));
            if (rows.length === 0) return null;
            return (
              <Section key={cat} title={cat}>
                <div className="m-card m-list">
                  {rows.map(c => (
                    <button key={c.id} type="button" className="m-row" onClick={() => setEdit({ from: c })}>
                      <ToolPhoto url={c.imageUrl} alt={c.name} className="m-thumb" />
                      <span className="m-row-main">
                        <span className="m-row-title" style={{ display: 'block' }}>{c.name}</span>
                        <span className="m-row-sub">{ownedCatalogIds.has(c.id) ? 'Already in this project' : 'Tap to add'}</span>
                      </span>
                      {ownedCatalogIds.has(c.id) ? <Badge tone="ok">Added</Badge> : <Plus size={20} className="is-muted" />}
                    </button>
                  ))}
                </div>
              </Section>
            );
          })}
        </>
      )}

      <Section title="Costs">
        <div className="m-card m-list">
          <button type="button" className="m-row" onClick={onOpenLedger}>
            <span className="m-row-main">
              <span className="m-row-title" style={{ display: 'block' }}>Tool purchase and rental costs</span>
              <span className="m-row-sub">Bills and payments are kept in the Tools ledger</span>
            </span>
            <ChevronRight size={18} className="is-muted" />
          </button>
        </div>
      </Section>

      {/* Tool detail */}
      <Sheet
        open={!!openTool && !issueFor && !returnFor && !edit}
        title={openTool?.name || ''}
        subtitle={openTool?.category}
        onClose={() => setOpenToolId(null)}
        footer={
          openTool && openStatus && (
            <>
              <button type="button" className="m-btn" onClick={() => setEdit({ tool: openTool })}><Pencil size={18} /> Edit</button>
              <button type="button" className="m-btn is-primary" onClick={() => setIssueFor(openTool)} disabled={openStatus.available < 1}>Issue tool</button>
            </>
          )
        }
      >
        {openTool && openStatus && (
          <>
            <ToolPhoto url={openTool.imageUrl} alt={openTool.name} className="m-tool-photo" />
            {openTool.imageCredit && <p className="m-calc-note" style={{ marginTop: 4 }}>Photo: {openTool.imageCredit} (Wikimedia Commons)</p>}
            <div className="m-stats is-3" style={{ marginTop: 10 }}>
              <Stat label="Total" value={openStatus.total} />
              <Stat label="Available" value={openStatus.available} tone={openStatus.available ? 'ok' : 'bad'} />
              <Stat label="Issued" value={openStatus.issued} tone={openStatus.issued ? 'warn' : undefined} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <Badge tone={openTool.condition === 'Good' ? 'ok' : 'bad'}>Condition: {openTool.condition}</Badge>
              {openStatus.lost > 0 && <Badge tone="bad">{openStatus.lost} lost</Badge>}
              {openStatus.needsAttention > 0 && <Badge tone="warn">{openStatus.needsAttention} returned damaged</Badge>}
            </div>
            {openTool.notes && <p className="m-calc-note">{openTool.notes}</p>}
            {openStatus.available < 1 && <div style={{ marginTop: 10 }}><Note tone="warn">None available to issue until one is returned.</Note></div>}

            <Section title="Issue and return history">
              {openStatus.history.length === 0 ? (
                <div className="m-card m-card-pad is-muted" style={{ fontSize: '0.9rem' }}>Not issued yet.</div>
              ) : (
                <div className="m-card m-list">
                  {openStatus.history.map(i => {
                    const out = outstandingQuantity(i);
                    return (
                      <div key={i.id} className="m-row" style={{ alignItems: 'flex-start' }}>
                        <span className="m-row-main">
                          <span style={{ display: 'block', fontWeight: 700 }}>{i.quantity} issued to {i.issuedTo}</span>
                          <span className="m-row-sub" style={{ display: 'block' }}>
                            {formatDateTime(i.issuedAt)}{i.expectedReturnDate ? ` · due ${formatDay(i.expectedReturnDate)}` : ''}
                          </span>
                          {(i.returns || []).map(r => (
                            <span key={r.id} className="m-row-sub" style={{ display: 'block' }}>
                              ↩ {r.quantity} returned {formatDateTime(r.returnedAt)} · {r.condition}{r.notes ? ' · ' + r.notes : ''}
                            </span>
                          ))}
                          {i.notes && <span className="m-row-sub" style={{ display: 'block' }}>Note: {i.notes}</span>}
                        </span>
                        {out > 0 ? (
                          <button type="button" className="m-btn is-small" onClick={() => setReturnFor(i)}>Return {out}</button>
                        ) : (
                          <Badge tone="ok">Returned</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </>
        )}
      </Sheet>

      {issueFor && (
        <IssueSheet
          tool={issueFor}
          status={statuses.get(issueFor.id)!}
          workers={project.workers.map(w => ({ id: w.id, name: w.name }))}
          user={user}
          siteId={siteId}
          onClose={() => setIssueFor(null)}
          onNotify={onNotify}
        />
      )}

      {returnFor && toolById.get(returnFor.toolAssetId) && (
        <ReturnSheet
          issue={returnFor}
          tool={toolById.get(returnFor.toolAssetId)!}
          user={user}
          siteId={siteId}
          onClose={() => setReturnFor(null)}
          onNotify={onNotify}
        />
      )}

      {edit && (
        <ToolEditSheet
          tool={edit.tool}
          from={edit.from}
          categories={catalogCategories}
          user={user}
          siteId={siteId}
          onClose={() => setEdit(null)}
          onSaved={(msg, id) => { onNotify(msg, 'success'); setEdit(null); setTab('tools'); setOpenToolId(id); }}
        />
      )}
    </Page>
  );
};

/* ------------------------------------------------------------------ Issue */

const IssueSheet: React.FC<{
  tool: ToolAsset;
  status: ToolStatus;
  workers: { id: string; name: string }[];
  user: User;
  siteId: string;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ tool, status, workers, user, siteId, onClose, onNotify }) => {
  const [issuedTo, setIssuedTo] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [due, setDue] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const worker = workers.find(w => w.name.toLowerCase() === issuedTo.trim().toLowerCase());
    const res = await issueTool(user, siteId, { toolAssetId: tool.id, quantity, issuedTo, workerId: worker?.id, expectedReturnDate: due || undefined, notes });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onNotify(`${quantity} × ${tool.name} issued to ${issuedTo.trim()}`, 'success');
    onClose();
  };

  return (
    <Sheet
      open
      title="Issue tool"
      subtitle={`${tool.name} · ${status.available} available`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="m-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="m-btn is-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Issue'}</button>
        </>
      }
    >
      {error && <div style={{ marginBottom: 12 }}><Note tone="bad" role="alert">{error}</Note></div>}
      <Field label="Given to">
        <input type="text" list="m-tool-workers" value={issuedTo} onChange={e => setIssuedTo(e.target.value)} placeholder="Worker or person name" maxLength={60} />
        <datalist id="m-tool-workers">{workers.map(w => <option key={w.id} value={w.name} />)}</datalist>
      </Field>
      {workers.length > 0 && (
        <div className="m-chips" style={{ marginTop: -6, marginBottom: 14 }}>
          {workers.slice(0, 8).map(w => (
            <button key={w.id} type="button" className="m-chip" aria-pressed={issuedTo === w.name} onClick={() => setIssuedTo(w.name)}>{w.name}</button>
          ))}
        </div>
      )}
      <Field label="Quantity">
        <Stepper value={quantity} max={status.available} onChange={setQuantity} label="Quantity to issue" />
      </Field>
      <Field label="Expected return date (optional)">
        <input type="date" value={due} min={todayKey()} onChange={e => setDue(e.target.value)} />
      </Field>
      <Field label="Notes (optional)">
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} maxLength={120} placeholder="Purpose / floor centering" />
      </Field>
      <p className="m-calc-note">The issue date and time are saved automatically as now.</p>
    </Sheet>
  );
};

/* ------------------------------------------------------------------ Return */

const ReturnSheet: React.FC<{
  issue: ToolIssue;
  tool: ToolAsset;
  user: User;
  siteId: string;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ issue, tool, user, siteId, onClose, onNotify }) => {
  const out = outstandingQuantity(issue);
  const [quantity, setQuantity] = useState(out);
  const [condition, setCondition] = useState<ToolCondition>('Good');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const res = await returnTool(user, siteId, { issueId: issue.id, quantity, condition, notes });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onNotify(condition === 'Lost' ? `${quantity} × ${tool.name} recorded as lost` : `${quantity} × ${tool.name} returned by ${issue.issuedTo}`, condition === 'Good' ? 'success' : 'info');
    onClose();
  };

  return (
    <Sheet
      open
      title="Return tool"
      subtitle={`${tool.name} · ${out} with ${issue.issuedTo}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="m-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="m-btn is-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : condition === 'Lost' ? 'Record as lost' : 'Record return'}</button>
        </>
      }
    >
      {error && <div style={{ marginBottom: 12 }}><Note tone="bad" role="alert">{error}</Note></div>}
      <p className="m-calc-note" style={{ marginTop: 0, marginBottom: 12 }}>
        Issued {formatDateTime(issue.issuedAt)}{issue.expectedReturnDate ? ` · due ${formatDay(issue.expectedReturnDate)}` : ''}
      </p>
      <Field label="Quantity coming back">
        <Stepper value={quantity} max={out} onChange={setQuantity} label="Quantity returned" />
      </Field>
      <Field label="Condition" hint={condition === 'Lost' ? 'Lost tools are removed from the available count.' : condition !== 'Good' ? 'It returns to stock and is flagged for attention.' : undefined}>
        <Chips label="Condition" value={condition} onChange={setCondition} options={TOOL_CONDITIONS.map(c => ({ value: c, label: c }))} />
      </Field>
      <Field label="Notes (optional)">
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} maxLength={120} placeholder="Condition details / notes" />
      </Field>
      <p className="m-calc-note">The return date and time are saved automatically as now.</p>
    </Sheet>
  );
};

/* ------------------------------------------------------------------ Add / edit */

const ToolEditSheet: React.FC<{
  tool?: ToolAsset;
  from?: CatalogItem;
  categories: string[];
  user: User;
  siteId: string;
  onClose: () => void;
  onSaved: (msg: string, toolId: string) => void;
}> = ({ tool, from, categories, user, siteId, onClose, onSaved }) => {
  const [name, setName] = useState(tool?.name || from?.name || '');
  const [category, setCategory] = useState(tool?.category || from?.category || categories[0] || 'Hand tools');
  const [quantity, setQuantity] = useState(tool?.totalQuantity || 1);
  const [condition, setCondition] = useState<ToolCondition>(tool?.condition || 'Good');
  const [notes, setNotes] = useState(tool?.notes || '');
  const [photo, setPhoto] = useState<string | undefined>(tool?.imageUrl || from?.imageUrl);
  const [credit, setCredit] = useState<string | undefined>(tool?.imageCredit || from?.imageCredit);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Choose an image file.');
    try {
      setPhoto(await fileToPhoto(file));
      setCredit(undefined); // the user's own photo carries no third-party credit
      setError('');
    } catch {
      setError('That photo could not be read. Try another one.');
    }
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const res = await saveToolAsset(user, siteId, {
      id: tool?.id, name, category, totalQuantity: quantity, condition, notes,
      catalogItemId: tool?.catalogItemId || from?.id, imageUrl: photo || '', imageCredit: credit || '',
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onSaved(tool ? `${res.value.name} updated` : `${res.value.name} added`, res.value.id);
  };

  return (
    <Sheet
      open
      title={tool ? 'Edit tool' : 'Add tool'}
      subtitle={from && !tool ? 'From the catalog' : undefined}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="m-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="m-btn is-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : tool ? 'Save' : 'Add to project'}</button>
        </>
      }
    >
      {error && <div style={{ marginBottom: 12 }}><Note tone="bad" role="alert">{error}</Note></div>}
      <ToolPhoto url={photo} alt={name || 'Tool'} className="m-tool-photo" />
      <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} style={{ display: 'none' }} />
      <button type="button" className="m-btn is-small" style={{ margin: '8px 0 14px' }} onClick={() => fileRef.current?.click()}>
        <Camera size={16} /> {photo ? 'Use my own photo' : 'Add a photo'}
      </button>
      <Field label="Tool name">
        <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="Tool / Equipment name" />
      </Field>
      <Field label="Category">
        <select value={category} onChange={e => setCategory(e.target.value)}>
          {(categories.includes(category) ? categories : [category, ...categories]).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Total quantity at this site">
        <Stepper value={quantity} max={9999} onChange={setQuantity} label="Total quantity" hideMax />
      </Field>
      <Field label="Current condition">
        <Chips label="Condition" value={condition} onChange={setCondition} options={TOOL_CONDITIONS.filter(c => c !== 'Lost').map(c => ({ value: c, label: c }))} />
      </Field>
      <Field label="Notes (optional)">
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} maxLength={160} />
      </Field>
    </Sheet>
  );
};
