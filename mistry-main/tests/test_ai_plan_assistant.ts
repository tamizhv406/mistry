/**
 * AI Design assistant service: the built-in path, and the AI-model path driven by a fake
 * server function. No real AI call is made. The fake returns what a model could return,
 * including wrong plans, to prove that only validated drafts come out and that failures are
 * reported as failures.
 */
import fs from 'node:fs';
import path from 'node:path';
import { askAssistant, assistantSource, type AssistantContext, type Invoke } from '../src/services/aiPlanAssistant';
import type { PlanSpec } from '../src/domain/planSpec';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const ctx: AssistantContext = { unit: 'feet', plot: { width: 30, depth: 40 }, current: null, currentIsFreeform: false };
const user = (text: string) => [{ role: 'user' as const, text }];

const goodPlan: PlanSpec = {
  unit: 'feet', plot: { width: 30, depth: 40 },
  rooms: [
    { id: 'living', type: 'Living Room', label: 'Living Room', x: 0, y: 24, width: 18, depth: 16, sizeSource: 'proposed' },
    { id: 'kitchen', type: 'Kitchen', label: 'Kitchen', x: 0, y: 12, width: 18, depth: 12, sizeSource: 'proposed' },
    { id: 'bed1', type: 'Master Bedroom', label: 'Master Bedroom', x: 18, y: 0, width: 12, depth: 20, sizeSource: 'proposed' },
    { id: 'bed2', type: 'Bedroom', label: 'Bedroom 2', x: 18, y: 20, width: 12, depth: 20, sizeSource: 'proposed' },
    { id: 'bath', type: 'Bathroom', label: 'Bathroom', x: 0, y: 0, width: 18, depth: 12, sizeSource: 'proposed' },
  ],
  doors: [{ from: 'living', to: 'outside', kind: 'main' }, { from: 'living', to: 'kitchen', kind: 'internal' }, { from: 'living', to: 'bed2', kind: 'internal' }, { from: 'kitchen', to: 'bed1', kind: 'internal' }, { from: 'bed1', to: 'bath', kind: 'bathroom' }],
  windows: [{ room: 'bed1', side: 'east' }],
};
const overlapping: PlanSpec = { ...goodPlan, rooms: goodPlan.rooms.map(r => (r.id === 'bed2' ? { ...r, y: 10 } : r)) };
const planReply = (plan: unknown) => ({ status: 200, data: { reply: { kind: 'plan', message: 'Here is a 2 BHK layout.', questions: [], assumptions: ['Bedroom sizes are proposed.'], plan } } });

async function run() {
  console.log('\n--- 1. Nothing is connected in this build ---');
  check('With no Supabase function configured the assistant reports the built-in source', assistantSource() === 'builtin');

  console.log('\n--- 2. Built-in rules ---');
  {
    const r = await askAssistant(user('30 × 40 ft, 2 BHK with two bathrooms'), ctx, { source: 'builtin' });
    check('A clear request gives a validated draft', r.kind === 'plan' && r.draft.check.ok && r.draft.source === 'builtin', r);
    if (r.kind !== 'plan') throw new Error('unreachable');
    check('The reply says it came from the built-in rules and that sizes are proposals', /built-in rules/.test(r.message) && /proposals/.test(r.message), r.message);
    const more = await askAssistant([...user('30 × 40 ft, 2 BHK with two bathrooms'), { role: 'assistant', text: r.message }, { role: 'user', text: 'add a pooja room' }], ctx, { source: 'builtin', lastProgram: r.draft.program });
    check('"add a pooja room" adds one room to the last layout', more.kind === 'plan' && more.draft.spec.rooms.length === r.draft.spec.rooms.length + 1 && more.draft.spec.rooms.some(x => x.type === 'Pooja'), more.kind === 'plan' ? more.draft.spec.rooms.map(x => x.label) : more);
    const less = await askAssistant(user('remove one bathroom'), ctx, { source: 'builtin', lastProgram: r.draft.program });
    check('"remove one bathroom" takes one room away', less.kind === 'plan' && less.draft.spec.rooms.filter(x => x.type === 'Bathroom').length === 1, less.kind === 'plan' ? less.draft.spec.rooms.map(x => x.label) : less);
    const tanglish = await askAssistant(user('innoru bedroom venum'), ctx, { source: 'builtin', lastProgram: r.draft.program });
    check('A Tanglish follow-up ("... bedroom venum") adds a bedroom', tanglish.kind === 'plan' && tanglish.draft.spec.rooms.filter(x => /Bedroom/.test(x.type)).length === 3, tanglish.kind === 'plan' ? tanglish.draft.spec.rooms.map(x => x.label) : tanglish);
  }
  {
    const vague = await askAssistant(user('what is the weather today'), ctx, { source: 'builtin' });
    check('Something it does not understand gets an honest explanation, not a made-up plan', vague.kind === 'message' && /No AI model is connected/.test(vague.message), vague);
    const noRooms = await askAssistant(user('30x40 plot'), ctx, { source: 'builtin' });
    check('A plot with no rooms gets a question', noRooms.kind === 'question' && noRooms.questions.length > 0, noRooms);
    const tooMany = await askAssistant(user('10x10 ft 5bhk with 5 bathrooms'), ctx, { source: 'builtin' });
    check('Rooms that can not fit are refused in words, with no draft', tooMany.kind === 'message' && /do not fit/.test(tooMany.message), tooMany);
  }

  console.log('\n--- 3. AI model path (fake server function) ---');
  {
    const calls: unknown[] = [];
    const invoke: Invoke = async body => { calls.push(body); return planReply(goodPlan); };
    const r = await askAssistant(user('30 by 40, 2 bhk'), ctx, { source: 'model', invoke });
    check('A valid model plan becomes a validated draft marked as from the model', r.kind === 'plan' && r.draft.check.ok && r.draft.source === 'model', r);
    check('The model was called once, with the plot and unit as context', calls.length === 1 && JSON.stringify(calls[0]).includes('"plot":{"width":30,"depth":40}'), calls[0]);
    check('The model\'s own assumptions are passed on to the user', r.kind === 'plan' && r.draft.assumptions.includes('Bedroom sizes are proposed.'));
  }
  {
    let n = 0;
    const invoke: Invoke = async () => { n += 1; return planReply(overlapping); };
    const r = await askAssistant(user('2 bhk'), ctx, { source: 'model', invoke });
    check('A plan with overlapping rooms is never returned as a draft', r.kind === 'error' && r.code === 'invalid_output', r);
    check('...the model got one chance to correct itself, then the failure is reported', n === 2 && r.kind === 'error' && /did not pass the plan checks/.test(r.message) && /overlap/.test(r.message), { n, r });
  }
  {
    const seen: string[] = [];
    let n = 0;
    const invoke: Invoke = async body => { n += 1; seen.push(JSON.stringify(body)); return planReply(n === 1 ? overlapping : goodPlan); };
    const r = await askAssistant(user('2 bhk'), ctx, { source: 'model', invoke });
    check('When the corrected plan is valid it is accepted', r.kind === 'plan' && r.draft.check.ok && n === 2, r);
    check('The correction request names the exact problems', /failed these checks/.test(seen[1]) && /overlap/.test(seen[1]), seen[1]?.slice(0, 200));
  }
  {
    const q: Invoke = async () => ({ status: 200, data: { reply: { kind: 'question', message: 'Plot size enna?', questions: ['Plot size enna?'], assumptions: [], plan: null } } });
    const r = await askAssistant(user('veedu plan venum'), { ...ctx, plot: { width: 0, depth: 0 } }, { source: 'model', invoke: q });
    check('A follow-up question from the model is shown as a question', r.kind === 'question' && r.questions[0] === 'Plot size enna?', r);
  }
  {
    const cases: [string, Invoke, string][] = [
      ['Not signed in (401)', async () => ({ status: 401, data: { error: 'not_signed_in' } }), 'not_signed_in'],
      ['No AI key on the server (503)', async () => ({ status: 503, data: { error: 'not_configured' } }), 'not_configured'],
      ['Function not deployed (404)', async () => ({ status: 404, data: null }), 'not_configured'],
      ['Rate limited (429)', async () => ({ status: 429, data: { error: 'rate_limited' } }), 'rate_limited'],
      ['Model declined', async () => ({ status: 200, data: { error: 'refused' } }), 'refused'],
      ['Network failure (throws)', async () => { throw new Error('offline'); }, 'network'],
      ['Text instead of a plan', async () => planReply('A lovely house with 2 bedrooms'), 'invalid_output'],
      ['Empty reply', async () => ({ status: 200, data: {} }), 'invalid_output'],
      ['Unknown reply kind', async () => ({ status: 200, data: { reply: { kind: 'poem', message: 'Roses are red' } } }), 'invalid_output'],
    ];
    for (const [name, invoke, code] of cases) {
      const r = await askAssistant(user('2 bhk'), ctx, { source: 'model', invoke });
      check(`${name} → error "${code}", no draft`, r.kind === 'error' && r.code === code, r);
    }
  }
  {
    // A plan in meters for a plan drawn in feet is converted, then validated in feet.
    const metric = { unit: 'meters', plot: { width: 9, depth: 12 }, rooms: [{ id: 'a', type: 'Living Room', label: 'Hall', x: 0, y: 6, width: 9, depth: 6, sizeSource: 'proposed' }, { id: 'b', type: 'Bedroom', label: 'Bedroom', x: 0, y: 0, width: 9, depth: 6, sizeSource: 'proposed' }], doors: [], windows: [] };
    const r = await askAssistant(user('9 m x 12 m'), ctx, { source: 'model', invoke: async () => planReply(metric) });
    check('A metric answer is converted to the plan\'s unit and given doors by rule', r.kind === 'plan' && r.draft.spec.unit === 'feet' && Math.abs(r.draft.spec.plot.width - 29.5) < 0.3 && r.draft.spec.doors.length >= 2, r.kind === 'plan' ? r.draft.spec.plot : r);
  }

  console.log('\n--- 4. No AI key in the app ---');
  {
    const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
    const files = walk(path.join(process.cwd(), 'src')).filter(f => /\.(ts|tsx)$/.test(f));
    const offenders = files.filter(f => /ANTHROPIC_API_KEY|sk-ant-|@anthropic-ai\/sdk|x-api-key/.test(fs.readFileSync(f, 'utf8')));
    check('No file under src/ mentions an AI key or imports the AI SDK', offenders.length === 0, offenders);
    const fn = fs.readFileSync(path.join(process.cwd(), 'supabase', 'functions', 'floor-plan-ai', 'index.ts'), 'utf8');
    check('The server function reads the key from a secret and checks the user first', /Deno\.env\.get\("ANTHROPIC_API_KEY"\)/.test(fn) && fn.indexOf('auth.getUser()') < fn.indexOf('ANTHROPIC_API_KEY")'), null);
    check('The server function has no key written in it', !/sk-ant-[A-Za-z0-9]/.test(fn));
  }

  console.log(`\n✅ AI Design assistant: all ${passed} checks passed.\n`);
}

run().catch(err => { console.error(err); process.exit(1); });
