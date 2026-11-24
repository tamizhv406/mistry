import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Loader2, Send, Sparkles, Undo2, X } from 'lucide-react';
import type { FloorPlanUnit } from '../db/types';
import type { FloorState } from '../domain/planDocument';
import { baseUnitOf } from '../domain/planGeometry';
import { buildFloorFromSpec, specFromFloor } from '../domain/planSpec';
import type { NewId } from '../domain/planEdit';
import { interpretPlanCommand, type CommandOption, type PlanProposal } from '../services/planCommands';
import { askAssistant, assistantSource, type ChatTurn } from '../services/aiPlanAssistant';

/**
 * Building Mistry AI: one panel for asking for changes to the plan.
 *
 *  - Edits to this floor ("Fix my plan", "Make this bedroom 10 feet wide", "Add a bathroom")
 *    are worked out on the device by services/planCommands.ts.
 *  - A request for a whole new layout ("2 BHK on 30 × 40") goes to the AI service when one is
 *    set up (through the floor-plan-ai server function, which holds the key), otherwise to the
 *    built-in layout rules. The panel says which is in use.
 *
 * Either way the answer is a proposal: it is drawn over the plan as a preview and nothing
 * changes until Apply. Anything that removes part of the plan asks a second time. After Apply
 * the panel checks the plan really changed before saying so, and offers Undo.
 *
 * There is no backdrop, so the drawing and the preview stay in view.
 */

interface Message { id: number; who: 'you' | 'ai'; text: string; tone?: 'ok' | 'bad' }

export interface MistryAiSheetProps {
  open: boolean;
  onClose: () => void;
  state: FloorState;
  unit: FloorPlanUnit;
  plot: { length: number; width: number };
  selected: { type: string; id: string } | null;
  newId: NewId;
  /** Draws a proposal over the plan (null clears it). Never changes the plan. */
  onPreview: (next: FloorState | null) => void;
  /** Applies a proposal as one undo step. Returns true only when the plan actually changed. */
  onApply: (next: FloorState) => boolean;
  onUndo: () => void;
}

const QUICK = ['Fix my plan', 'Make this bedroom 10 feet wide', 'Add a bathroom'];
const LAYOUT_REQUEST = /\b\d\s*bhk\b|\bbhk\b|\b(design|layout|new plan|house plan|plan for|draw (?:a|me|my) (?:house|home|plan))\b|\bplot\b/i;

export const MistryAiSheet: React.FC<MistryAiSheetProps> = ({ open, onClose, state, unit, plot, selected, newId, onPreview, onApply, onUndo }) => {
  const source = assistantSource();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ proposal: PlanProposal; base: FloorState; confirm: boolean } | null>(null);
  const [question, setQuestion] = useState<{ text: string; options: CommandOption[] } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const nextId = useRef(1);
  const turnsRef = useRef<ChatTurn[]>([]);
  const requestRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const appliedRef = useRef<FloorState | null>(null);

  const say = (who: Message['who'], text: string, tone?: Message['tone']) =>
    setMessages(list => [...list.slice(-30), { id: nextId.current++, who, text, tone }]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, pending, question]);

  // A proposal is worked out from the plan as it was. If the plan is changed some other way
  // meanwhile, the proposal is out of date and is dropped rather than applied over the change.
  useEffect(() => {
    if (!pending || state === pending.base || state === appliedRef.current) return;
    setPending(null);
    onPreview(null);
    say('ai', 'The plan was changed while this was waiting, so that proposal was dropped. Ask again.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Closing the panel drops a waiting proposal and its preview.
  useEffect(() => {
    if (open) return;
    requestRef.current += 1;
    setBusy(false);
    setPending(null);
    setQuestion(null);
    onPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const propose = (proposal: PlanProposal) => {
    setPending({ proposal, base: state, confirm: false });
    onPreview(proposal.next);
    say('ai', proposal.summary);
  };

  const askForLayout = async (text: string) => {
    const ticket = ++requestRef.current;
    setBusy(true);
    turnsRef.current = [...turnsRef.current, { role: 'user' as const, text }].slice(-12);
    try {
      const current = specFromFloor(state, unit, { width: plot.length, depth: plot.width });
      const reply = await askAssistant(turnsRef.current, {
        unit: baseUnitOf(unit),
        plot: { width: plot.length, depth: plot.width },
        current,
        currentIsFreeform: !current && state.walls.length > 0,
      });
      if (ticket !== requestRef.current) return;
      if (reply.kind === 'error') { say('ai', reply.message, 'bad'); return; }
      turnsRef.current = [...turnsRef.current, { role: 'assistant' as const, text: reply.message }];
      if (reply.kind === 'question') { say('ai', [reply.message, ...reply.questions].join(' ')); return; }
      if (reply.kind === 'message') { say('ai', reply.message); return; }
      if (!reply.draft.check.ok) {
        say('ai', `That layout did not pass the plan checks, so it was not drawn: ${reply.draft.check.errors.slice(0, 2).join(' ')}`, 'bad');
        return;
      }
      const built = buildFloorFromSpec(reply.draft.spec, unit, p => newId(p === 'door' ? 'door' : p === 'room' ? 'room' : 'wall'));
      const drawing = state.walls.length + state.rooms.length + state.doors.length + state.windows.length;
      propose({
        title: 'New layout',
        summary: `${reply.message} ${drawing ? 'This replaces the drawing on this floor.' : ''}`.trim(),
        changes: [
          `${built.state.rooms.length} rooms, ${built.state.walls.length} walls, ${built.state.doors.length} doors`,
          ...reply.draft.assumptions.slice(0, 4),
        ],
        warnings: [...built.dropped, ...reply.draft.check.warnings].slice(0, 4),
        destructive: drawing > 0,
        next: { ...state, ...built.state, furniture: drawing ? [] : state.furniture },
      });
    } catch {
      if (ticket === requestRef.current) say('ai', 'Something went wrong while asking. Nothing was changed.', 'bad');
    } finally {
      if (ticket === requestRef.current) setBusy(false);
    }
  };

  const run = (text: string, targetRoomId?: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    if (pending) onPreview(null);
    setPending(null);
    setQuestion(null);
    if (!targetRoomId) say('you', clean);
    const result = interpretPlanCommand(clean, { state, unit, plot, selected, targetRoomId, newId });
    if (result.kind === 'proposal') return propose(result.proposal);
    if (result.kind === 'question') {
      setQuestion({ text: clean, options: result.options });
      return say('ai', result.message);
    }
    if (result.kind === 'answer') return say('ai', result.message);
    if (LAYOUT_REQUEST.test(clean)) { void askForLayout(clean); return; }
    say('ai', result.message);
  };

  const apply = () => {
    if (!pending) return;
    if (pending.proposal.destructive && !pending.confirm) {
      setPending({ ...pending, confirm: true });
      return;
    }
    appliedRef.current = pending.proposal.next;
    const changed = onApply(pending.proposal.next);
    onPreview(null);
    setPending(null);
    if (changed) {
      setCanUndo(true);
      say('ai', `Done. ${pending.proposal.summary}`, 'ok');
    } else {
      say('ai', 'Nothing changed on the plan, so nothing was applied.', 'bad');
    }
  };

  const cancel = () => {
    setPending(null);
    onPreview(null);
    say('ai', 'Cancelled. The plan was not changed.');
  };

  if (!open) return null;
  const p = pending?.proposal;
  return (
    <section className={`mai-sheet no-print ${p ? 'has-proposal' : ''}`} role="dialog" aria-label="Building Mistry AI" id="mistry-ai-sheet">
      <header className="mai-head">
        <span className="mai-head-icon" aria-hidden="true"><Sparkles size={18} /></span>
        <div className="mai-head-text">
          <h2>Building Mistry AI</h2>
          <p>{source === 'model' ? 'Edits run on this device · new layouts use the AI service' : 'Edits run on this device · no AI service is set up'}</p>
        </div>
        <button type="button" className="mai-icon-btn" onClick={onClose} aria-label="Close Building Mistry AI"><X size={20} /></button>
      </header>

      <div className="mai-body" ref={listRef}>
        {messages.length === 0 && (
          <p className="mai-empty">Ask for a change. You will see it on the plan first, and nothing changes until you tap Apply.</p>
        )}
        {messages.map(m => (
          <div key={m.id} className={`mai-msg is-${m.who} ${m.tone ? `is-${m.tone}` : ''}`}>{m.text}</div>
        ))}
        {busy && <div className="mai-msg is-ai is-busy" role="status"><Loader2 size={16} className="mai-spin" /> Working…</div>}

        {question && (
          <div className="mai-options" role="group" aria-label="Choose a room">
            {question.options.map(o => (
              <button key={o.roomId} type="button" className="mai-chip" onClick={() => run(question.text, o.roomId)}>{o.label}</button>
            ))}
          </div>
        )}

        {p && (
          <div className={`mai-proposal ${p.destructive ? 'is-destructive' : ''}`} id="mistry-ai-proposal">
            <div className="mai-proposal-title">{p.title}</div>
            {p.changes.length > 0 && (
              <ul className="mai-list">{p.changes.map(c => <li key={c}>{c}</li>)}</ul>
            )}
            {p.warnings.length > 0 && (
              <ul className="mai-list is-warn">{p.warnings.map(w => <li key={w}><AlertTriangle size={14} aria-hidden="true" /> {w}</li>)}</ul>
            )}
            <p className="mai-note">Shown dashed on the plan. Nothing has changed yet.</p>
            {pending?.confirm && (
              <p className="mai-confirm" role="alert">This removes part of the plan. Tap Apply again to go ahead. You can undo it afterwards.</p>
            )}
            <div className="mai-actions">
              <button type="button" className="mai-btn" onClick={cancel}>Cancel</button>
              <button type="button" className={`mai-btn is-primary ${pending?.confirm ? 'is-danger' : ''}`} onClick={apply} id="mistry-ai-apply">
                <Check size={16} /> {pending?.confirm ? 'Apply anyway' : 'Apply'}
              </button>
            </div>
          </div>
        )}
      </div>

      {!p && !busy && (
        <div className="mai-quick" role="group" aria-label="Examples">
          {QUICK.map(q => <button key={q} type="button" className="mai-chip" onClick={() => run(q)}>{q}</button>)}
          {canUndo && (
            <button type="button" className="mai-chip is-undo" onClick={() => { onUndo(); setCanUndo(false); say('ai', 'Undone. The plan is back as it was.'); }}>
              <Undo2 size={14} /> Undo last change
            </button>
          )}
        </div>
      )}

      <form className="mai-input" onSubmit={e => { e.preventDefault(); const t = input; setInput(''); run(t); }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="e.g. Make this bedroom 10 feet wide"
          aria-label="Ask Building Mistry AI"
          maxLength={500}
          disabled={busy}
          id="mistry-ai-input"
        />
        <button type="submit" className="mai-send" disabled={busy || !input.trim()} aria-label="Send"><Send size={18} /></button>
      </form>
    </section>
  );
};
