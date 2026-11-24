import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, ChevronDown, ChevronRight, Minus, Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { db } from '../../db/db';
import type { CatalogItem, ToolAsset, ToolCondition, ToolIssue, User } from '../../db/types';
import { useProject } from '../../hooks/useProject';
import { TOOL_CATEGORIES } from '../../domain/catalog';
import {
  buildToolStatus, daysOut, isLate, issueDay, matchesToolFilter, outstandingQuantity, TOOL_CONDITIONS, TOOL_FILTERS,
  toolAction, toolMatches, toolState, type ToolFilter, type ToolStatus,
} from '../../domain/toolTracking';
import { ensureCatalogSeeded, issueTool, markToolRepaired, removeToolAsset, returnTool, saveToolAsset } from '../../services/records';
import { useLanguage } from '../../services/i18n';
import { formatDateTime, formatDay, todayKey } from '../../utils/datetime';
import { Badge, Chips, ConfirmSheet, Empty, Field, Loading, Note, Page, SearchBox, Section, Sheet } from '../../components/mobile/kit';
import '../../styles/materials-mobile.css';

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

/** The small square at the start of a row: the person's own photo when they added one, else an icon. */
const ToolIcon: React.FC<{ tool: Pick<ToolAsset, 'imageUrl' | 'name'> }> = ({ tool }) => {
  const [failed, setFailed] = useState(false);
  if (tool.imageUrl?.startsWith('data:') && !failed) {
    return <img className="stk-icon stk-icon-photo" src={tool.imageUrl} alt="" onError={() => setFailed(true)} />;
  }
  return <span className="stk-icon" aria-hidden="true"><Wrench size={18} /></span>;
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
    {!hideMax && <span className="is-muted" style={{ fontSize: 14 }}>of {max}</span>}
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

type Notify = (msg: string, type?: 'success' | 'error' | 'info') => void;

interface ToolRoomViewProps {
  user: User;
  siteId: string;
  onBack: () => void;
  onOpenLedger: () => void;
  onNotify: Notify;
}

export const ToolRoomView: React.FC<ToolRoomViewProps> = ({ user, siteId, onBack, onOpenLedger, onNotify }) => {
  const { t } = useLanguage();
  const project = useProject(siteId);
  const catalog = useLiveQuery(() => db.catalogItems.filter(c => !c.isDeleted && c.kind === 'tool').toArray(), []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ToolFilter>('all');
  const [openToolId, setOpenToolId] = useState<string | null>(null);
  const [issueFor, setIssueFor] = useState<ToolAsset | null>(null);
  const [returnFor, setReturnFor] = useState<{ tool: ToolAsset; issueId?: string } | null>(null);
  const [edit, setEdit] = useState<{ tool?: ToolAsset; from?: CatalogItem } | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    ensureCatalogSeeded().catch(() => onNotify('Could not load the tool catalog.', 'error'));
    // Seed once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = todayKey();
  const statuses = useMemo(() => {
    const map = new Map<string, ToolStatus>();
    if (project) for (const tool of project.toolAssets) map.set(tool.id, buildToolStatus(tool, project.toolIssues, today));
    return map;
  }, [project, today]);

  if (project === undefined) return <Page title="Tools" onBack={onBack}><Loading rows={4} /></Page>;
  if (project === null) return <Page title="Tools" onBack={onBack}><div className="m-card"><Empty icon={<Wrench size={26} />} title="Project not found" /></div></Page>;

  const tools = [...project.toolAssets].sort((a, b) => a.name.localeCompare(b.name));
  const toolById = new Map(tools.map(x => [x.id, x]));
  const all = tools.map(x => statuses.get(x.id)!).filter(Boolean);
  const outNow = all.reduce((s, st) => s + st.issued, 0);
  const lateCount = all.reduce((s, st) => s + st.holders.filter(h => h.late).length, 0);
  const availableNow = all.reduce((s, st) => s + (st.unusable ? 0 : st.available), 0);

  const countOf = (f: ToolFilter) => all.filter(st => matchesToolFilter(st, f)).length;
  const shown = tools.filter(x => matchesToolFilter(statuses.get(x.id)!, filter) && toolMatches(x, statuses.get(x.id)!, query));
  const catalogCategories = Array.from(new Set([...TOOL_CATEGORIES, ...(catalog || []).map(c => c.category)]));
  const openTool = openToolId ? toolById.get(openToolId) : undefined;
  const openStatus = openTool ? statuses.get(openTool.id) : undefined;

  const statusLine = (st: ToolStatus) => {
    const state = toolState(st);
    if (state === 'out') {
      const first = st.holders[0];
      const more = st.holders.length > 1 ? ` +${st.holders.length - 1}` : '';
      const here = st.available > 0 && !st.unusable ? ` · ${st.available} ${t('tl_here', 'Available').toLowerCase()}` : '';
      return <span className="stk-qty">{t('tl_with', 'With {name}').replace('{name}', first.name)}{first.quantity > 1 ? ` (${first.quantity})` : ''}{more}{here}</span>;
    }
    if (state === 'available') {
      return <span className="stk-qty is-ok">{t('tl_here', 'Available')}{st.available > 1 ? ` · ${st.available}` : ''}</span>;
    }
    return <span className="stk-qty is-bad">{t('tl_damaged', 'Damaged')}</span>;
  };

  return (
    <Page title="Tools" subtitle={project.site.name} className="stk-screen" onBack={onBack}>
      <div className="stk-page">
        {tools.length === 0 ? (
          <div className="m-card">
            <Empty
              icon={<Wrench size={26} />}
              title="No tools added yet"
              action={<button type="button" className="m-btn is-primary" onClick={() => setAdding(true)}><Plus size={20} /> {t('tl_add_tool', 'Add tool')}</button>}
            >
              Add the tools kept at this site. Then issue them to workers and record when they come back.
            </Empty>
          </div>
        ) : (
          <>
            <SearchBox value={query} onChange={setQuery} placeholder={t('tl_search', 'Search tools')} />
            <div className="stk-chips" role="group" aria-label="Status">
              {TOOL_FILTERS.map(f => (
                <button key={f} type="button" className="stk-chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {t(`tl_chip_${f}`)} ({countOf(f)})
                </button>
              ))}
            </div>

            <div className="stk-summary">
              <div><span>{t('tl_out_now', 'Out now')}</span><strong>{outNow}</strong></div>
              <div><span>{t('tl_late', 'Late')}</span><strong className={lateCount ? 'is-bad' : ''}>{lateCount}</strong></div>
              <div><span>{t('tl_chip_available', 'Available')}</span><strong>{availableNow}</strong></div>
            </div>

            <div className="m-card stk-list">
              {shown.map(tool => {
                const st = statuses.get(tool.id)!;
                const action = toolAction(st);
                return (
                  <div key={tool.id} className="stk-row">
                    <button type="button" className="stk-row-main" onClick={() => setOpenToolId(tool.id)} aria-label={`${tool.name}. Open history`}>
                      <ToolIcon tool={tool} />
                      <span className="stk-text">
                        <span className="stk-name">
                          {st.late && <span className="stk-low">{t('tl_late', 'Late')}</span>}
                          {tool.name}{st.total > 1 ? ` × ${st.total}` : ''}
                        </span>
                        <span className="stk-qty-line">{statusLine(st)}</span>
                      </span>
                    </button>
                    {action === 'issue' && (
                      <button type="button" className="stk-act is-in" onClick={() => setIssueFor(tool)} aria-label={`${t('tl_issue', 'Issue')}: ${tool.name}`}>
                        <span className="stk-act-word">{t('tl_issue', 'Issue')}</span>
                      </button>
                    )}
                    {action === 'return' && (
                      <button type="button" className="stk-act is-out" onClick={() => setReturnFor({ tool })} aria-label={`${t('tl_return', 'Return')}: ${tool.name}`}>
                        <span className="stk-act-word">{t('tl_return', 'Return')}</span>
                      </button>
                    )}
                  </div>
                );
              })}
              {shown.length === 0 && <div className="m-row is-muted">{t('tl_no_match', 'No tool matches.')}</div>}
            </div>

            <div className="stk-tools">
              <button type="button" className="m-btn" onClick={() => setAdding(true)}><Plus size={18} /> {t('tl_add_tool', 'Add tool')}</button>
              <button type="button" className="m-btn" onClick={onOpenLedger}>Tool costs <ChevronRight size={18} /></button>
            </div>
          </>
        )}

        {/* Detail: who has it, history, edit, repair, remove */}
        {openTool && openStatus && !issueFor && !returnFor && !edit && (
          <ToolDetailSheet
            tool={openTool}
            status={openStatus}
            user={user}
            siteId={siteId}
            onClose={() => setOpenToolId(null)}
            onIssue={() => setIssueFor(openTool)}
            onReturn={issueId => setReturnFor({ tool: openTool, issueId })}
            onEdit={() => setEdit({ tool: openTool })}
            onNotify={onNotify}
          />
        )}

        {adding && (
          <AddToolSheet
            catalog={catalog || []}
            ownedCatalogIds={new Set(tools.map(x => x.catalogItemId).filter((id): id is string => !!id))}
            onClose={() => setAdding(false)}
            onPick={from => { setAdding(false); setEdit({ from }); }}
            onCustom={() => { setAdding(false); setEdit({}); }}
          />
        )}

        {issueFor && (
          <IssueSheet
            tool={issueFor}
            status={statuses.get(issueFor.id)!}
            workers={project.workers.filter(w => !w.isDeleted).map(w => ({ id: w.id, name: w.name }))}
            user={user}
            siteId={siteId}
            onClose={() => setIssueFor(null)}
            onNotify={onNotify}
          />
        )}

        {returnFor && statuses.get(returnFor.tool.id) && statuses.get(returnFor.tool.id)!.openIssues.length > 0 && (
          <ReturnSheet
            tool={returnFor.tool}
            issues={statuses.get(returnFor.tool.id)!.holders.map(h => h.issue)}
            initialIssueId={returnFor.issueId}
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
            onSaved={(msg, id) => { onNotify(msg, 'success'); setEdit(null); setOpenToolId(id); }}
          />
        )}
      </div>
    </Page>
  );
};

/* ------------------------------------------------------------------ Detail */

const ToolDetailSheet: React.FC<{
  tool: ToolAsset;
  status: ToolStatus;
  user: User;
  siteId: string;
  onClose: () => void;
  onIssue: () => void;
  onReturn: (issueId: string) => void;
  onEdit: () => void;
  onNotify: Notify;
}> = ({ tool, status, user, siteId, onClose, onIssue, onReturn, onEdit, onNotify }) => {
  const { t } = useLanguage();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = todayKey();

  const remove = async () => {
    setBusy(true);
    const res = await removeToolAsset(user, siteId, tool.id);
    setBusy(false);
    setConfirmRemove(false);
    if (!res.ok) return onNotify(res.error, 'error');
    onNotify(`${tool.name} removed`, 'info');
    onClose();
  };

  const repair = async () => {
    setBusy(true);
    const res = await markToolRepaired(user, siteId, tool.id, status.damaged);
    setBusy(false);
    if (!res.ok) return onNotify(res.error, 'error');
    onNotify(`${tool.name}: ${status.damaged} back in use`, 'success');
  };

  return (
    <>
      <Sheet
        open={!confirmRemove}
        title={tool.name}
        subtitle={tool.category}
        onClose={onClose}
        footer={
          <>
            <button type="button" className="m-btn" onClick={onEdit}><Pencil size={18} /> Edit</button>
            <button type="button" className="m-btn is-primary" onClick={onIssue} disabled={toolAction(status) !== 'issue'}>{t('tl_issue', 'Issue')}</button>
          </>
        }
      >
        <div className="stk-summary" style={{ marginTop: 0 }}>
          <div><span>Total</span><strong>{status.total}</strong></div>
          <div><span>{t('tl_chip_available', 'Available')}</span><strong>{status.unusable ? 0 : status.available}</strong></div>
          <div><span>{t('tl_out_now', 'Out now')}</span><strong>{status.issued}</strong></div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          <Badge tone={tool.condition === 'Good' ? 'ok' : 'bad'}>Condition: {tool.condition}</Badge>
          {status.lost > 0 && <Badge tone="bad">{status.lost} lost</Badge>}
        </div>
        {status.unusable && <div style={{ marginTop: 10 }}><Note tone="warn">Marked {tool.condition}. It can not be issued until you edit it back to Good.</Note></div>}
        {status.damaged > 0 && (
          <div className="m-card m-card-pad" style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700 }}>{status.damaged} returned damaged, kept aside</div>
            <button type="button" className="m-btn" style={{ marginTop: 8 }} onClick={repair} disabled={busy}>Mark repaired</button>
          </div>
        )}
        {tool.notes && <p className="m-calc-note">{tool.notes}</p>}

        {status.holders.length > 0 && (
          <Section title="Who has it">
            <div className="m-card m-list">
              {status.holders.map(h => (
                <div key={h.issue.id} className="m-row">
                  <span className="m-row-main">
                    <span className="m-row-title" style={{ display: 'block' }}>
                      {h.late && <span className="stk-low">{t('tl_late', 'Late')}</span>}
                      {h.name}{h.quantity > 1 ? ` (${h.quantity})` : ''}
                    </span>
                    <span className="m-row-sub" style={{ display: 'block' }}>
                      Since {formatDay(issueDay(h.issue))}{daysOut(h.issue, today) > 0 ? ` · ${daysOut(h.issue, today)} day${daysOut(h.issue, today) === 1 ? '' : 's'} out` : ' · today'}
                    </span>
                  </span>
                  <button type="button" className="m-btn" onClick={() => onReturn(h.issue.id)}>{t('tl_return', 'Return')}</button>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Issue and return history">
          {status.history.length === 0 ? (
            <div className="m-card m-card-pad is-muted">Not issued yet.</div>
          ) : (
            <div className="m-card m-list">
              {status.history.map(i => (
                <div key={i.id} className="m-row" style={{ alignItems: 'flex-start' }}>
                  <span className="m-row-main">
                    <span style={{ display: 'block', fontWeight: 700 }}>
                      {i.quantity > 1 ? `${i.quantity} to ` : 'To '}{i.issuedTo}
                      {isLate(i, today) && <> <span className="stk-low">{t('tl_late', 'Late')}</span></>}
                    </span>
                    <span className="m-row-sub" style={{ display: 'block' }}>Issued {formatDateTime(i.issuedAt)}{i.expectedReturnDate ? ` · due ${formatDay(i.expectedReturnDate)}` : ''}</span>
                    {(i.returns || []).map(r => (
                      <span key={r.id} className="m-row-sub" style={{ display: 'block' }}>
                        Returned {r.quantity > 1 ? `${r.quantity} ` : ''}{formatDateTime(r.returnedAt)} · {r.condition}{r.notes ? ' · ' + r.notes : ''}
                      </span>
                    ))}
                    {outstandingQuantity(i) > 0 && <span className="m-row-sub" style={{ display: 'block', fontWeight: 700 }}>Still out: {outstandingQuantity(i)}</span>}
                    {i.notes && <span className="m-row-sub" style={{ display: 'block' }}>Note: {i.notes}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <button type="button" className="m-btn is-danger is-block" style={{ marginTop: 16 }} onClick={() => setConfirmRemove(true)}>
          <Trash2 size={18} /> Remove tool
        </button>
      </Sheet>

      <ConfirmSheet
        open={confirmRemove}
        title={`Remove ${tool.name}?`}
        message={status.issued > 0
          ? `${tool.name} is still with ${status.holders.map(h => h.name).join(', ')}. Record the return first.`
          : 'It leaves the tool list. Its issue and return history is kept.'}
        confirmLabel="Remove"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmRemove(false)}
      />
    </>
  );
};

/* ------------------------------------------------------------------ Add from catalog */

const AddToolSheet: React.FC<{
  catalog: CatalogItem[];
  ownedCatalogIds: Set<string>;
  onClose: () => void;
  onPick: (from: CatalogItem) => void;
  onCustom: () => void;
}> = ({ catalog, ownedCatalogIds, onClose, onPick, onCustom }) => {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const rows = catalog
    .filter(c => !q || c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return (
    <Sheet open title={t('tl_add_tool', 'Add tool')} subtitle="Pick from the list, or add your own" onClose={onClose}>
      <SearchBox value={search} onChange={setSearch} placeholder={t('tl_search', 'Search tools')} />
      <button type="button" className="m-btn is-block" style={{ marginTop: 10 }} onClick={onCustom}>
        <Plus size={18} /> {q ? `Add "${search.trim()}" with my own photo` : 'A tool that is not listed (own photo)'}
      </button>
      <div className="m-card m-list" style={{ marginTop: 10 }}>
        {rows.map(c => (
          <button key={c.id} type="button" className="m-row" onClick={() => onPick(c)} disabled={ownedCatalogIds.has(c.id)}>
            <span className="stk-icon" aria-hidden="true"><Wrench size={18} /></span>
            <span className="m-row-main">
              <span className="m-row-title" style={{ display: 'block' }}>{c.name}</span>
              <span className="m-row-sub">{c.category}{ownedCatalogIds.has(c.id) ? ' · already added' : ''}</span>
            </span>
            {!ownedCatalogIds.has(c.id) && <Plus size={20} className="is-muted" />}
          </button>
        ))}
        {rows.length === 0 && <div className="m-row is-muted">{t('tl_no_match', 'No tool matches.')}</div>}
      </div>
    </Sheet>
  );
};

/* ------------------------------------------------------------------ Issue: tool, who, date */

const IssueSheet: React.FC<{
  tool: ToolAsset;
  status: ToolStatus;
  workers: { id: string; name: string }[];
  user: User;
  siteId: string;
  onClose: () => void;
  onNotify: Notify;
}> = ({ tool, status, workers, user, siteId, onClose, onNotify }) => {
  const { t } = useLanguage();
  const [other, setOther] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [day, setDay] = useState(todayKey());
  const [showMore, setShowMore] = useState(false);
  const [due, setDue] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  // Tapping a name issues the tool: tap "Issue" on the row, tap the name. Two taps.
  const issueTo = async (name: string, workerId?: string) => {
    if (saving.current) return;
    if (!name.trim()) return setError('Enter who is receiving the tool.');
    saving.current = true;
    setBusy(true);
    setError('');
    const res = await issueTool(user, siteId, {
      toolAssetId: tool.id, quantity, issuedTo: name, workerId, issuedOn: day, expectedReturnDate: due || undefined, notes,
    });
    saving.current = false;
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onNotify(`${quantity > 1 ? `${quantity} × ` : ''}${tool.name} issued to ${name.trim()}`, 'success');
    onClose();
  };

  return (
    <Sheet
      open
      title={`${t('tl_issue', 'Issue')}: ${tool.name}`}
      subtitle={`${status.available} ${t('tl_chip_available', 'Available').toLowerCase()}`}
      onClose={onClose}
      footer={<button type="button" className="m-btn" onClick={onClose} disabled={busy}>Cancel</button>}
    >
      {error && <div style={{ marginBottom: 12 }}><Note tone="bad" role="alert">{error}</Note></div>}

      <Field label={t('tl_date', 'Date')} hint={day !== todayKey() ? 'Past date: saved as issued on that day.' : undefined}>
        <input type="date" value={day} max={todayKey()} onChange={e => setDay(e.target.value)} />
      </Field>
      {status.available > 1 && (
        <Field label="How many">
          <Stepper value={quantity} max={status.available} onChange={setQuantity} label="Quantity to issue" />
        </Field>
      )}

      <div className="m-field-label" style={{ marginBottom: 8 }}>{t('tl_who', 'Who is taking it? Tap the name.')}</div>
      {workers.length > 0 && (
        <div className="tl-people">
          {workers.map(w => (
            <button key={w.id} type="button" className="m-btn" onClick={() => issueTo(w.name, w.id)} disabled={busy}>{w.name}</button>
          ))}
        </div>
      )}
      <div className="stk-level" style={{ marginTop: 10 }}>
        <Field label={workers.length ? 'Someone else' : 'Name'}>
          <input type="text" value={other} onChange={e => setOther(e.target.value)} placeholder="Person's name" maxLength={60} />
        </Field>
        <button
          type="button"
          className="m-btn is-primary"
          style={{ marginBottom: 14 }}
          disabled={busy || !other.trim()}
          onClick={() => {
            const known = workers.find(w => w.name.toLowerCase() === other.trim().toLowerCase());
            issueTo(other, known?.id);
          }}
        >
          {t('tl_issue', 'Issue')}
        </button>
      </div>

      <button type="button" className="stk-more-toggle" aria-expanded={showMore} onClick={() => setShowMore(v => !v)}>
        <span>{t('stk_more', 'More details')}</span>
        <ChevronDown size={18} aria-hidden="true" style={{ transform: showMore ? 'rotate(180deg)' : undefined }} />
      </button>
      {showMore && (
        <>
          <Field label="Expected back by (optional)" hint="Without a date, a tool not back by the end of the day shows Late.">
            <input type="date" value={due} min={todayKey()} onChange={e => setDue(e.target.value)} />
          </Field>
          <Field label="Notes (optional)">
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} maxLength={120} placeholder="Purpose / floor centering" />
          </Field>
        </>
      )}
    </Sheet>
  );
};

/* ------------------------------------------------------------------ Return: condition and date */

const ReturnSheet: React.FC<{
  tool: ToolAsset;
  issues: ToolIssue[];
  initialIssueId?: string;
  user: User;
  siteId: string;
  onClose: () => void;
  onNotify: Notify;
}> = ({ tool, issues, initialIssueId, user, siteId, onClose, onNotify }) => {
  const { t } = useLanguage();
  const [issueId, setIssueId] = useState(initialIssueId && issues.some(i => i.id === initialIssueId) ? initialIssueId : issues[0].id);
  const issue = issues.find(i => i.id === issueId) || issues[0];
  const out = outstandingQuantity(issue);
  const [quantity, setQuantity] = useState(out);
  const [condition, setCondition] = useState<ToolCondition>('Good');
  const [day, setDay] = useState(todayKey());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  const pick = (id: string) => {
    setIssueId(id);
    setQuantity(outstandingQuantity(issues.find(i => i.id === id) || issue));
  };

  const submit = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    const res = await returnTool(user, siteId, { issueId: issue.id, quantity: Math.min(quantity, out), condition, notes, returnedOn: day });
    saving.current = false;
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onNotify(condition === 'Lost' ? `${tool.name} recorded as lost` : `${tool.name} returned by ${issue.issuedTo}`, condition === 'Good' ? 'success' : 'info');
    onClose();
  };

  return (
    <Sheet
      open
      title={`${t('tl_return', 'Return')}: ${tool.name}`}
      subtitle={`${t('tl_with', 'With {name}').replace('{name}', issue.issuedTo)} · since ${formatDay(issueDay(issue))}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="m-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="m-btn is-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : condition === 'Lost' ? 'Record as lost' : 'Save return'}</button>
        </>
      }
    >
      {error && <div style={{ marginBottom: 12 }}><Note tone="bad" role="alert">{error}</Note></div>}
      {issues.length > 1 && (
        <Field label="Returned by">
          <Chips label="Returned by" value={issue.id} onChange={pick} options={issues.map(i => ({ value: i.id, label: `${i.issuedTo}${outstandingQuantity(i) > 1 ? ` (${outstandingQuantity(i)})` : ''}` }))} />
        </Field>
      )}
      <Field label={t('tl_condition', 'Condition')} hint={condition === 'Lost' ? 'Lost tools come off the total.' : condition !== 'Good' ? 'Kept aside until you mark it repaired.' : undefined}>
        <Chips label="Condition" value={condition} onChange={setCondition} options={TOOL_CONDITIONS.map(c => ({ value: c, label: c }))} />
      </Field>
      <Field label={t('tl_date', 'Date')}>
        <input type="date" value={day} min={issueDay(issue)} max={todayKey()} onChange={e => setDay(e.target.value)} />
      </Field>
      {out > 1 && (
        <Field label="How many came back">
          <Stepper value={Math.min(quantity, out)} max={out} onChange={setQuantity} label="Quantity returned" />
        </Field>
      )}
      <Field label="Notes (optional)">
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} maxLength={120} placeholder="What is wrong with it" />
      </Field>
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
      {credit && <p className="m-calc-note" style={{ marginTop: 4 }}>Photo: {credit} (Wikimedia Commons)</p>}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pickPhoto} style={{ display: 'none' }} />
      <div className="m-btn-row" style={{ margin: '8px 0 14px' }}>
        <button type="button" className="m-btn" onClick={() => fileRef.current?.click()}>
          <Camera size={18} /> {photo ? 'Use my own photo' : 'Add a photo'}
        </button>
        {photo && <button type="button" className="m-btn" onClick={() => { setPhoto(undefined); setCredit(undefined); }}>Remove photo</button>}
      </div>
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
      <Field label="Current condition" hint="Damaged or Needs Repair stops it being issued.">
        <Chips label="Condition" value={condition} onChange={setCondition} options={TOOL_CONDITIONS.filter(c => c !== 'Lost').map(c => ({ value: c, label: c }))} />
      </Field>
      <Field label="Notes (optional)">
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} maxLength={160} />
      </Field>
    </Sheet>
  );
};
