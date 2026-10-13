import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Eye, MessageSquare, RotateCcw, Send, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import {
  askAssistant, assistantSource, EXAMPLE_PROMPTS,
  type AssistantContext, type AssistantSource, type ChatTurn, type PlanDraft,
} from '../services/aiPlanAssistant';
import { PLAN_SPEC_DISCLAIMER, sizeText, unitRules, type RoomProgram } from '../domain/planSpec';

type Item =
  | { id: number; kind: 'user'; text: string }
  | { id: number; kind: 'assistant'; text: string; questions?: string[] }
  | { id: number; kind: 'draft'; text: string; draft: PlanDraft }
  | { id: number; kind: 'error'; text: string; offerBuiltin: boolean };

// Omit on its own would collapse the union to its shared fields; this keeps each kind's own.
type OmitEach<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type NewItem = OmitEach<Item, 'id'>;

type Stage = 'chat' | 'preview' | 'confirm' | 'applied';

export interface AiDesignSheetProps {
  open: boolean;
  onClose: () => void;
  /** The plan being edited: unit, plot and (when its rooms are rectangles) the current layout. */
  context: AssistantContext;
  /** What Apply would replace, so the user is asked before losing a drawing. */
  floor: { name: string; walls: number; rooms: number; other: number };
  /** Shows a draft over the drawing (or hides it with null). Never changes the plan. */
  onPreview: (draft: PlanDraft | null) => void;
  /** Replaces the floor with the draft as one undoable step. */
  onApply: (draft: PlanDraft) => void;
  /** Undoes the step made by onApply. */
  onUndoApply: () => void;
}

/**
 * AI Design: a compact chat that produces a plan draft. A draft is only ever shown as a
 * preview; the drawing changes when the user taps Apply (and confirms, if there is already a
 * drawing), and that change can be undone. There is no backdrop: the canvas stays visible and
 * usable the whole time.
 */
export const AiDesignSheet: React.FC<AiDesignSheetProps> = ({ open, onClose, context, floor, onPreview, onApply, onUndoApply }) => {
  const defaultSource = assistantSource();
  const [items, setItems] = useState<Item[]>([]);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [stage, setStage] = useState<Stage>('chat');
  const nextId = useRef(1);
  const requestRef = useRef(0);
  const programRef = useRef<RoomProgram | undefined>(undefined);
  const listRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const push = (item: NewItem) => setItems(prev => [...prev, { ...item, id: nextId.current++ } as Item]);

  // Keep the sheet above the on-screen keyboard: fixed elements are not moved by it on Android.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !vv) return;
    const place = () => {
      const hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      rootRef.current?.style.setProperty('--fp-aid-keyboard', `${Math.round(hidden)}px`);
    };
    place();
    vv.addEventListener('resize', place);
    vv.addEventListener('scroll', place);
    return () => { vv.removeEventListener('resize', place); vv.removeEventListener('scroll', place); };
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, busy, stage]);

  if (!open) return null;

  const c = unitRules(context.unit);
  const hasPlot = context.plot.width > 0 && context.plot.depth > 0;

  const run = async (history: ChatTurn[], source: AssistantSource) => {
    const request = ++requestRef.current;
    setBusy(true);
    const reply = await askAssistant(
      history,
      // While a draft is open, follow-ups ("make the kitchen bigger") are about the draft.
      { ...context, current: draft?.spec ?? context.current, currentIsFreeform: draft ? false : context.currentIsFreeform },
      { source, lastProgram: programRef.current },
    );
    if (request !== requestRef.current) return;          // stopped or closed meanwhile
    setBusy(false);
    if (reply.kind === 'error') {
      push({ kind: 'error', text: reply.message, offerBuiltin: source === 'model' && reply.code !== 'refused' });
      return;
    }
    setTurns([...history, { role: 'assistant', text: reply.message }]);
    if (reply.kind === 'plan') {
      programRef.current = reply.draft.program;
      setDraft(reply.draft);
      push({ kind: 'draft', text: reply.message, draft: reply.draft });
    } else {
      push({ kind: 'assistant', text: reply.message, questions: reply.kind === 'question' ? reply.questions : undefined });
    }
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const history: ChatTurn[] = [...turns, { role: 'user', text: trimmed }];
    setTurns(history);
    setInput('');
    push({ kind: 'user', text: trimmed });
    void run(history, defaultSource);
  };

  const stop = () => {
    requestRef.current += 1;
    setBusy(false);
    push({ kind: 'assistant', text: 'Stopped. Nothing was changed.' });
  };

  const discard = () => {
    setDraft(null);
    onPreview(null);
    setStage('chat');
    push({ kind: 'assistant', text: 'Draft discarded. Your drawing was not changed.' });
  };

  const close = () => {
    requestRef.current += 1;
    setBusy(false);
    onPreview(null);
    if (stage !== 'applied') setStage('chat');
    onClose();
  };

  const showPreview = (d: PlanDraft) => {
    setDraft(d);
    onPreview(d);
    setStage('preview');
  };

  const floorHasDrawing = floor.walls + floor.rooms + floor.other > 0;
  const plotChanges = !!draft && hasPlot &&
    (Math.abs(draft.spec.plot.width - context.plot.width) > 0.01 || Math.abs(draft.spec.plot.depth - context.plot.depth) > 0.01);

  const apply = () => {
    if (!draft || !draft.check.ok) return;
    onPreview(null);
    onApply(draft);
    setStage('applied');
    push({ kind: 'assistant', text: `Applied to ${floor.name}. You can edit every wall, room, door and window as usual, or undo.` });
    setDraft(null);
  };

  const sourceLabel = (s: AssistantSource) => (s === 'model' ? 'AI model' : 'Built-in rules');

  // ── Compact bar: the draft is on the drawing and the canvas has the screen ──
  if (stage !== 'chat') {
    return (
      <div className="fp-aid fp-aid-bar no-print" ref={rootRef} role="dialog" aria-label="AI Design draft">
        {stage === 'preview' && draft && (
          <>
            <div className="fp-aid-bar-text">
              <strong>Draft preview</strong>
              <span>{draft.spec.rooms.length} rooms · {draft.spec.plot.width} × {draft.spec.plot.depth} {c.len} · not applied yet</span>
            </div>
            <div className="fp-aid-bar-actions">
              <button type="button" className="fp-aid-btn" onClick={() => { onPreview(null); setStage('chat'); }} id="fp-aid-back">
                <MessageSquare size={16} /> Chat
              </button>
              <button type="button" className="fp-aid-btn" onClick={discard} id="fp-aid-cancel">
                <X size={16} /> Cancel
              </button>
              <button type="button" className="fp-aid-btn is-primary" onClick={() => (floorHasDrawing || plotChanges ? setStage('confirm') : apply())} id="fp-aid-apply">
                <Check size={16} /> Apply
              </button>
            </div>
          </>
        )}
        {stage === 'confirm' && draft && (
          <>
            <div className="fp-aid-bar-text">
              <strong>{floorHasDrawing ? `Replace the drawing on ${floor.name}?` : 'Apply this draft?'}</strong>
              <span>
                {floorHasDrawing && `It has ${floor.walls} wall${floor.walls === 1 ? '' : 's'} and ${floor.rooms} room${floor.rooms === 1 ? '' : 's'}${floor.other ? ` and ${floor.other} other item${floor.other === 1 ? '' : 's'}` : ''}. `}
                {plotChanges && `The plot changes from ${context.plot.width} × ${context.plot.depth} to ${draft.spec.plot.width} × ${draft.spec.plot.depth} ${c.len}. `}
                You can undo this.
              </span>
            </div>
            <div className="fp-aid-bar-actions">
              <button type="button" className="fp-aid-btn" onClick={() => setStage('preview')} id="fp-aid-keep">
                <ArrowLeft size={16} /> Keep mine
              </button>
              <button type="button" className="fp-aid-btn is-primary" onClick={apply} id="fp-aid-replace">
                <Check size={16} /> {floorHasDrawing ? 'Replace' : 'Apply'}
              </button>
            </div>
          </>
        )}
        {stage === 'applied' && (
          <>
            <div className="fp-aid-bar-text">
              <strong>Draft applied</strong>
              <span>Sizes marked proposed are suggestions. Edit anything, or undo.</span>
            </div>
            <div className="fp-aid-bar-actions">
              <button type="button" className="fp-aid-btn" onClick={() => { onUndoApply(); setStage('chat'); push({ kind: 'assistant', text: 'Undone. Your earlier drawing is back.' }); }} id="fp-aid-undo">
                <Undo2 size={16} /> Undo
              </button>
              <button type="button" className="fp-aid-btn" onClick={() => setStage('chat')} id="fp-aid-more">
                <MessageSquare size={16} /> Change it
              </button>
              <button type="button" className="fp-aid-btn is-primary" onClick={() => { setStage('chat'); onClose(); }} id="fp-aid-done">
                <Check size={16} /> Done
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Chat ──
  return (
    <div className="fp-aid fp-aid-sheet no-print" ref={rootRef} role="dialog" aria-label="AI Design">
      <div className="fp-aid-head">
        <span className="fp-aid-head-icon"><Sparkles size={16} /></span>
        <div className="fp-aid-head-text">
          <strong>AI Design</strong>
          <span>{defaultSource === 'model' ? 'Describe the house. You get a draft to preview first.' : 'Built-in layout rules · no AI model connected'}</span>
        </div>
        <button type="button" className="fp-aid-icon-btn" onClick={close} aria-label="Close AI Design" id="fp-aid-close">
          <X size={18} />
        </button>
      </div>

      <div className="fp-aid-list" ref={listRef}>
        {items.length === 0 && (
          <div className="fp-aid-intro">
            <p>
              {defaultSource === 'model'
                ? 'Describe the plot size and rooms you need. I will prepare a draft for review; nothing changes until you select Apply.'
                : 'Type a plot size, BHK and room names. A draft is made by fixed layout rules; nothing changes until you tap Apply.'}
            </p>
            <p className="fp-aid-muted">
              {hasPlot ? `This plan's plot: ${context.plot.width} × ${context.plot.depth} ${c.len}.` : 'This plan has no plot size yet, so include it.'}
              {context.currentIsFreeform && ' The current drawing is free-form, so a draft will replace it rather than change it room by room.'}
            </p>
            <div className="fp-aid-chips">
              {EXAMPLE_PROMPTS.slice(0, context.current ? 4 : 3).map(p => (
                <button key={p} type="button" className="fp-aid-chip" onClick={() => send(p)}>{p}</button>
              ))}
            </div>
          </div>
        )}

        {items.map(item => {
          if (item.kind === 'user') return <div key={item.id} className="fp-aid-msg is-user">{item.text}</div>;
          if (item.kind === 'assistant') {
            return (
              <div key={item.id} className="fp-aid-msg">
                {item.text}
                {item.questions && item.questions.length > 1 && (
                  <ul className="fp-aid-points">{item.questions.map(q => <li key={q}>{q}</li>)}</ul>
                )}
              </div>
            );
          }
          if (item.kind === 'error') {
            return (
              <div key={item.id} className="fp-aid-msg is-error" role="alert">
                <AlertTriangle size={16} />
                <div>
                  {item.text}
                  {item.offerBuiltin && (
                    <button type="button" className="fp-aid-link" onClick={() => void run(turns, 'builtin')}>
                      Use the built-in layout rules for this request
                    </button>
                  )}
                </div>
              </div>
            );
          }
          const d = item.draft;
          const live = draft === d;
          return (
            <div key={item.id} className={`fp-aid-draft ${live ? '' : 'is-old'}`}>
              <div className="fp-aid-draft-head">
                <strong>Draft · {d.spec.rooms.length} rooms · {d.spec.plot.width} × {d.spec.plot.depth} {c.len}</strong>
                <span className="fp-aid-badge">{sourceLabel(d.source)}</span>
              </div>
              <p className="fp-aid-draft-text">{item.text}</p>
              <ul className="fp-aid-rooms">
                {d.spec.rooms.map(r => (
                  <li key={r.id}>
                    <span>{r.label}</span>
                    <span className="fp-aid-size">{sizeText(r, d.spec.unit)}</span>
                    <span className={`fp-aid-tag ${r.sizeSource === 'user' ? 'is-user' : ''}`}>{r.sizeSource === 'user' ? 'your size' : 'proposed'}</span>
                  </li>
                ))}
              </ul>
              {d.assumptions.length > 0 && (
                <ul className="fp-aid-points">{d.assumptions.map(a => <li key={a}>{a}</li>)}</ul>
              )}
              {[...d.notes, ...d.check.warnings].length > 0 && (
                <ul className="fp-aid-points is-warn">{[...new Set([...d.notes, ...d.check.warnings])].map(w => <li key={w}>{w}</li>)}</ul>
              )}
              <p className="fp-aid-muted">{PLAN_SPEC_DISCLAIMER}</p>
              {live && (
                <div className="fp-aid-draft-actions">
                  <button type="button" className="fp-aid-btn" onClick={discard}>
                    <Trash2 size={16} /> Discard
                  </button>
                  <button type="button" className="fp-aid-btn is-primary" onClick={() => showPreview(d)} id="fp-aid-preview">
                    <Eye size={16} /> Preview on drawing
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {busy && (
          <div className="fp-aid-msg is-busy" role="status">
            <RotateCcw size={15} className="spin" />
            <span>{defaultSource === 'model' ? 'Working on a layout. This can take up to a minute.' : 'Arranging rooms…'}</span>
            <button type="button" className="fp-aid-link" onClick={stop}>Stop</button>
          </div>
        )}
      </div>

      <form className="fp-aid-input" onSubmit={e => { e.preventDefault(); send(input); }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={draft ? 'Change the draft, e.g. "add a pooja room"' : 'e.g. 30 × 40 ft, 2 BHK with two bathrooms'}
          aria-label="Describe the plan"
          id="fp-aid-text"
          enterKeyHint="send"
          autoComplete="off"
          maxLength={600}
        />
        <button type="submit" className="fp-aid-send" disabled={busy || !input.trim()} aria-label="Send" id="fp-aid-send">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
