/**
 * AI Design assistant: turns a chat message into a validated plan draft.
 *
 * Two sources, never mixed up:
 *  - 'model'   : the AI model, reached only through the `floor-plan-ai` Supabase Edge Function.
 *                The API key lives on the server; this file never sees it.
 *  - 'builtin' : the layout rules in domain/planSpec.ts. Used when no AI function is configured.
 *                It understands plot size, BHK and room names, and says so.
 *
 * Whatever the source, a draft is only returned after it has passed validatePlanSpec, and it
 * is never applied here: the editor previews it and the user decides.
 */
import { isSupabaseConfigured, supabase } from './supabase';
import {
  autoOpenings, convertSpecUnit, layoutProgram, parsePlanSpec, readPlanPrompt, snapSpec, unitRules, validatePlanSpec,
  type PlanSpec, type ProgramRoom, type RoomProgram, type SpecCheck,
} from '../domain/planSpec';
import type { BaseUnit } from '../domain/planGeometry';

const FUNCTION_NAME: string =
  ((typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_AI_DESIGN_FUNCTION) || '').trim();

export type AssistantSource = 'model' | 'builtin';

/** Which assistant this build can use. The AI model needs Supabase and a deployed function name. */
export function assistantSource(): AssistantSource {
  return FUNCTION_NAME && isSupabaseConfigured() && supabase ? 'model' : 'builtin';
}

export interface ChatTurn { role: 'user' | 'assistant'; text: string }

export interface AssistantContext {
  unit: BaseUnit;
  plot: { width: number; depth: number };
  /** The floor being edited, when all its rooms are rectangles; null for an empty or free-form floor. */
  current: PlanSpec | null;
  /** True when the floor has a drawing that can not be described as rectangular rooms. */
  currentIsFreeform: boolean;
}

export interface PlanDraft {
  spec: PlanSpec;
  check: SpecCheck;
  assumptions: string[];
  notes: string[];
  source: AssistantSource;
  /** Built-in drafts keep the room list they came from, so "add a pooja room" can follow up. */
  program?: RoomProgram;
}

export type AssistantErrorCode = 'not_signed_in' | 'not_configured' | 'network' | 'rate_limited' | 'refused' | 'invalid_output' | 'too_long' | 'server';

export type AssistantReply =
  | { kind: 'plan'; message: string; draft: PlanDraft }
  | { kind: 'question'; message: string; questions: string[]; source: AssistantSource }
  | { kind: 'message'; message: string; source: AssistantSource }
  | { kind: 'error'; code: AssistantErrorCode; message: string };

/** Sends a request to the server function. Replaced by a fake in tests. */
export type Invoke = (body: unknown) => Promise<{ status: number; data: unknown }>;

const defaultInvoke: Invoke = async body => {
  if (!supabase) return { status: 0, data: null };
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return { status: 401, data: { error: 'not_signed_in' } };
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body: body as Record<string, unknown> });
  if (!error) return { status: 200, data };
  const res = (error as { context?: unknown }).context;
  if (res && typeof (res as Response).status === 'number') {
    let payload: unknown = null;
    try { payload = await (res as Response).json(); } catch { /* an error page, not JSON */ }
    return { status: (res as Response).status, data: payload };
  }
  return { status: 0, data: null };
};

const ERROR_TEXT: Record<AssistantErrorCode, string> = {
  not_signed_in: 'Sign in to cloud backup (Account) to use the AI model. Your plan was not changed.',
  not_configured: 'The AI model is not set up on the server yet. An admin has to add the AI key to the floor-plan-ai function. Your plan was not changed.',
  network: 'Could not reach the AI service. Check the internet connection and try again.',
  rate_limited: 'The AI service is busy right now. Try again in a minute.',
  refused: 'The AI declined this request.',
  invalid_output: 'The AI answer did not pass the plan checks, so nothing was drawn.',
  too_long: 'This conversation is too long for the AI. Start a new chat and describe the plan again.',
  server: 'The AI service returned an error. Nothing was changed.',
};

const errorReply = (code: AssistantErrorCode, detail?: string): AssistantReply =>
  ({ kind: 'error', code, message: detail ? `${ERROR_TEXT[code]} ${detail}` : ERROR_TEXT[code] });

function codeFor(status: number, data: unknown): AssistantErrorCode {
  const named = (data as { error?: string } | null)?.error;
  const known: AssistantErrorCode[] = ['not_signed_in', 'not_configured', 'network', 'rate_limited', 'refused', 'invalid_output', 'too_long', 'server'];
  if (named && known.includes(named as AssistantErrorCode)) return named as AssistantErrorCode;
  if (status === 0) return 'network';
  if (status === 401 || status === 403) return 'not_signed_in';
  if (status === 404 || status === 503) return 'not_configured';
  if (status === 429) return 'rate_limited';
  if (status === 413) return 'too_long';
  return 'server';
}

/** Makes a checked draft out of a spec that came from anywhere. */
function draftFrom(raw: PlanSpec, ctx: AssistantContext, source: AssistantSource, assumptions: string[], notes: string[], program?: RoomProgram): PlanDraft {
  let spec = snapSpec(convertSpecUnit(raw, ctx.unit));
  const extra: string[] = [];
  if (!spec.doors.length) {
    const openings = autoOpenings(spec);
    spec = { ...spec, doors: openings.doors, windows: spec.windows.length ? spec.windows : openings.windows };
    extra.push(...openings.notes);
  }
  return { spec, check: validatePlanSpec(spec), assumptions, notes: [...notes, ...extra], source, program };
}

// ---------------------------------------------------------------------------
// Built-in rules
// ---------------------------------------------------------------------------

const ADD = /\b(add|include|one more|another|extra|plus|venum|vendum|serthu|podu)\b|சேர்|வேண்டும்/;
const REMOVE = /\b(remove|delete|without|drop|venda|vendam|venam|edu)\b|நீக்கு|வேண்டாம்/;

/** A follow-up such as "add a pooja room" or "remove parking", applied to the last room list. */
function editProgram(previous: RoomProgram, message: string): RoomProgram | null {
  const text = message.toLowerCase();
  const adding = ADD.test(text);
  const removing = REMOVE.test(text);
  if (!adding && !removing) return null;
  // Read the rooms named in the message on their own, then add them to or take them from the list.
  const named = readPlanPrompt(message.replace(/\d+\s*-?\s*bhk/gi, ' '), { unit: previous.unit, plotWidth: previous.plotWidth, plotDepth: previous.plotDepth });
  const rooms = (named.program?.rooms || []).filter(r => !(r.type === 'Living Room' && !/living|hall|ஹால்/.test(text)));
  if (!rooms.length) return null;
  let next: ProgramRoom[] = [...previous.rooms];
  if (removing && !adding) {
    for (const r of rooms) {
      const at = next.map(x => x.type).lastIndexOf(r.type === 'Master Bedroom' ? 'Master Bedroom' : r.type);
      if (at >= 0) next.splice(at, 1);
    }
    if (next.length === previous.rooms.length) return null;
  } else {
    for (const r of rooms) {
      const count = next.filter(x => x.type === r.type).length;
      const base = r.label.replace(/\s+\d+$/, '');
      next.push({ ...r, label: count ? `${base} ${count + (r.type === 'Bedroom' && next.some(x => x.type === 'Master Bedroom') ? 2 : 1)}` : r.label });
    }
  }
  next = next.filter(Boolean);
  return next.length ? { ...previous, rooms: next } : null;
}

const BUILTIN_HELP =
  'No AI model is connected, so this is the built-in layout generator. It understands a plot size, BHK and room names, for example: "30 × 40 ft, 2 BHK with pooja room and car parking". It can also add or remove a room from its last layout.';

function askBuiltin(turns: ChatTurn[], ctx: AssistantContext, lastProgram?: RoomProgram): AssistantReply {
  const message = turns[turns.length - 1]?.text || '';
  const fallback = { unit: ctx.unit, plotWidth: ctx.plot.width, plotDepth: ctx.plot.depth };

  const edited = lastProgram ? editProgram(lastProgram, message) : null;
  let program = edited;
  let assumptions: string[] = [];
  if (!program) {
    const reading = readPlanPrompt(message, fallback);
    if (!reading.program) {
      if (reading.questions.length && /\d|bhk|room|plot|bed|kitchen|hall|வீடு|அறை/i.test(message)) {
        return { kind: 'question', message: reading.questions[0], questions: reading.questions, source: 'builtin' };
      }
      return { kind: 'message', message: BUILTIN_HELP, source: 'builtin' };
    }
    program = reading.program;
    assumptions = reading.assumptions;
  }
  const laid = layoutProgram(program);
  // A request typed in the other unit ("9 m x 12 m" on a feet plan) is drawn in the plan's own unit.
  const draft = draftFrom(laid.spec, ctx, 'builtin', assumptions, laid.notes, program);
  const c = unitRules(draft.spec.unit);
  const size = `${draft.spec.plot.width} × ${draft.spec.plot.depth} ${c.len}`;
  if (!draft.check.ok) {
    return { kind: 'message', source: 'builtin', message: `These rooms do not fit on a ${size} plot at usable sizes: ${draft.check.errors.slice(0, 2).join(' ')} Try fewer rooms or a larger plot.` };
  }
  return {
    kind: 'plan',
    message: `${edited ? 'Updated draft' : 'Draft'}: ${draft.spec.rooms.length} rooms on a ${size} plot, arranged by the built-in rules. All sizes are proposals. Preview it on the drawing, then apply or cancel.`,
    draft,
  };
}

// ---------------------------------------------------------------------------
// AI model (through the server function)
// ---------------------------------------------------------------------------

interface ModelReply {
  kind?: unknown; message?: unknown; questions?: unknown; assumptions?: unknown; plan?: unknown;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim()) : []);

async function askModel(turns: ChatTurn[], ctx: AssistantContext, invoke: Invoke): Promise<AssistantReply> {
  const context = {
    unit: ctx.unit,
    plot: ctx.plot,
    currentPlan: ctx.current ? { rooms: ctx.current.rooms.map(r => ({ id: r.id, type: r.type, label: r.label, x: r.x, y: r.y, width: r.width, depth: r.depth })) }
      : ctx.currentIsFreeform ? 'not rectangular' : 'empty',
  };
  let conversation = turns;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: { status: number; data: unknown };
    try {
      res = await invoke({ turns: conversation, context });
    } catch {
      return errorReply('network');
    }
    const errorName = (res.data as { error?: string } | null)?.error;
    if (res.status !== 200 || errorName) return errorReply(codeFor(res.status, res.data));

    const reply = ((res.data as { reply?: ModelReply } | null)?.reply || null) as ModelReply | null;
    const text = typeof reply?.message === 'string' ? reply.message.trim() : '';
    if (!reply || !text) return errorReply('invalid_output');
    if (reply.kind === 'question') return { kind: 'question', message: text, questions: strings(reply.questions).slice(0, 3), source: 'model' };
    if (reply.kind === 'message') return { kind: 'message', message: text, source: 'model' };
    if (reply.kind !== 'plan') return errorReply('invalid_output');

    const parsed = parsePlanSpec(reply.plan);
    const draft = parsed.spec ? draftFrom(parsed.spec, ctx, 'model', strings(reply.assumptions), parsed.problems) : null;
    const problems = draft ? draft.check.errors : parsed.problems;
    if (draft && draft.check.ok) return { kind: 'plan', message: text, draft };
    if (attempt === 0) {
      // One chance to correct itself: the exact problems are sent back as the next user turn.
      conversation = [
        ...turns,
        { role: 'assistant', text },
        { role: 'user', text: `That plan failed these checks and was not drawn:\n- ${problems.slice(0, 8).join('\n- ')}\nReturn the full corrected plan.` },
      ];
      continue;
    }
    return errorReply('invalid_output', problems.slice(0, 3).join(' '));
  }
  return errorReply('invalid_output');
}

/**
 * Answers one chat message. `options.source` lets the user choose the built-in rules even
 * when the AI model is available (for example after an AI error).
 */
export async function askAssistant(
  turns: ChatTurn[],
  ctx: AssistantContext,
  options: { source?: AssistantSource; invoke?: Invoke; lastProgram?: RoomProgram } = {},
): Promise<AssistantReply> {
  const source = options.source ?? assistantSource();
  if (source === 'builtin') return askBuiltin(turns, ctx, options.lastProgram);
  return askModel(turns, ctx, options.invoke ?? defaultInvoke);
}

export const EXAMPLE_PROMPTS: string[] = [
  '30 × 40 ft, 2 BHK with two bathrooms',
  '3 BHK with pooja room and car parking',
  '30x40 plot la rendu bedroom, hall, kitchen venum',
  'Add a store room',
];
