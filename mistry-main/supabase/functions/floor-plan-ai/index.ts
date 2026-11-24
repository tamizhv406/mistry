/**
 * floor-plan-ai: the server side of "AI Design" in the Mistry floor planner.
 *
 * The app never talks to the AI provider directly and never holds an API key. It calls this
 * Supabase Edge Function with the signed-in user's session; the function adds the key (a
 * server-side secret), asks Claude for a structured plan and returns it as data. The app then
 * validates that data again before anything is drawn.
 *
 * Setup (once per Supabase project):
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *   supabase functions deploy floor-plan-ai
 * and in the app's build environment:
 *   VITE_AI_DESIGN_FUNCTION=floor-plan-ai
 *
 * Without the secret this function answers 503 "not_configured" and the app says so.
 */
import Anthropic from "npm:@anthropic-ai/sdk@^0.133.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@^0.133.0/helpers/zod";
import { z } from "npm:zod@^4.6.5";
import { createClient } from "npm:@supabase/supabase-js@^2.116.0";

const MODEL = "claude-opus-5-5";
const MAX_TURNS = 20;
const MAX_TURN_CHARS = 4000;
const MAX_CONTEXT_CHARS = 24000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// The shape Claude must answer in. The app re-checks every number; this only fixes the form.
const Room = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  depth: z.number(),
  sizeSource: z.enum(["user", "proposed"]),
});
const Door = z.object({
  from: z.string(),
  to: z.string(),
  kind: z.enum(["main", "internal", "bathroom", "opening"]),
});
const Window = z.object({
  room: z.string(),
  side: z.enum(["north", "south", "east", "west"]),
});
const Plan = z.object({
  unit: z.enum(["feet", "meters"]),
  plot: z.object({ width: z.number(), depth: z.number() }),
  rooms: z.array(Room),
  doors: z.array(Door),
  windows: z.array(Window),
});
const Reply = z.object({
  kind: z.enum(["plan", "question", "message"]),
  message: z.string(),
  questions: z.array(z.string()),
  assumptions: z.array(z.string()),
  plan: Plan.nullable(),
});

const SYSTEM_PROMPT = `You are the design assistant inside Mistry, a floor-plan app used by building contractors and house owners in India, mostly on phones. People describe a plot and the rooms they want; you answer with a conceptual room layout as structured data, which the app draws as an editable 2D plan. People may also ask you to change a plan they already have.

You only ever answer through the structured reply. Its fields:
- kind: "plan" when you are returning a layout, "question" when you cannot lay anything out without more information, "message" for anything else (a question about the plan you can answer in words, or a request that is not about floor plans).
- message: one or two short sentences for the person. Write in the language and style they wrote in: English, Tamil, or Tanglish (Tamil in Latin letters). Plain words, no jargon.
- questions: only for kind "question"; at most two short questions.
- assumptions: for kind "plan", each thing you decided that the person did not say (for example "Bedroom sizes were not given, so 12 × 11 ft is proposed"). Same language as message. Empty otherwise.
- plan: the layout for kind "plan", otherwise null.

How the plan is laid out:
- Every room is an axis-aligned rectangle given by x, y (its north-west corner), width (east-west) and depth (north-south), in the plan's unit.
- The origin is the plot's north-west corner. x grows east, y grows south. The road and main entrance are on the south edge (y = plot depth) unless the person says otherwise.
- Every room lies fully inside the plot. No two rooms overlap. Rooms that are neighbours share a wall line exactly: one room's edge coordinate equals the other's, so the app can draw one wall between them.
- Use round numbers the app can draw: multiples of 0.5 in feet, 0.1 in meters.
- Do not leave unexplained gaps between rooms inside the building. The building may be smaller than the plot only when the person asks for open space, setbacks, a garden or similar; otherwise fill the plot.
- Give each room a short id (for example "living", "bed1"), a label, and a type chosen from: Living Room, Master Bedroom, Bedroom, Guest Room, Kids Room, Kitchen, Dining, Bathroom, Toilet, Utility, Store, Study, Pooja, Balcony, Corridor, Staircase, Parking, Office, Terrace, Custom. Labels are in English unless the person named the room themselves.
- doors: one door with to = "outside" and kind "main" for the entrance, then enough doors that every room can be reached from the entrance through the living room, dining or a corridor. A door can only join two rooms that share a wall at least 4 ft (1.2 m) long. A bathroom opens from a bedroom or a corridor, and from the kitchen only if nothing else is possible. kind is "bathroom" for bathroom and toilet doors, "internal" otherwise, "opening" for an open archway.
- windows: one per room that has an outside wall, naming the side. Never on a wall shared with another room.

Sizes and honesty:
- If the person gave a size, use exactly that size and set sizeSource to "user". If they did not, choose a sensible size, set sizeSource to "proposed", and list it in assumptions. Never describe a proposed size as a requirement.
- If the plot size is given neither in the conversation nor in the context below the message, ask for it (kind "question"). Ask only for what you truly need; propose the rest.
- If everything asked for cannot fit on the plot at usable sizes, still return the closest layout you can, and say plainly in message what does not fit well.
- This is a concept sketch. Do not say or imply that it meets building rules, setbacks, vastu, or structural needs, and do not give structural sizes (beams, columns, steel). If asked, say a qualified engineer or architect must check those.

Changing an existing plan:
- The context may contain the current plan as rooms with positions and sizes. When the person asks for a change (add a room, resize one, move a door), return the complete updated plan. Keep every room that is not affected exactly as it is, with the same id, position and size, and keep sizeSource "user" for rooms taken from the current plan.
- If the current plan is described as "not rectangular" you cannot edit it room by room; say so in a "message" reply and offer to draw a new layout instead.`;

interface Turn { role: "user" | "assistant"; text: string }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // Only signed-in Mistry users may spend the project's AI budget.
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return json(401, { error: "not_signed_in" });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(503, { error: "not_configured" });

  let body: { turns?: Turn[]; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_request", detail: "The request body is not JSON." });
  }
  const turns = Array.isArray(body.turns) ? body.turns : [];
  const context = JSON.stringify(body.context ?? {});
  const validTurns = turns.every(t => (t?.role === "user" || t?.role === "assistant") && typeof t.text === "string" && t.text.trim().length > 0);
  if (!turns.length || !validTurns || turns[turns.length - 1].role !== "user") {
    return json(400, { error: "bad_request", detail: "Send the conversation as turns ending with a user turn." });
  }
  // Refuse oversized input instead of cutting it: a truncated request would be answered wrongly.
  if (turns.length > MAX_TURNS || turns.some(t => t.text.length > MAX_TURN_CHARS) || context.length > MAX_CONTEXT_CHARS) {
    return json(413, { error: "too_long" });
  }

  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((t, i) => ({
    role: t.role,
    // The plan context travels with the latest user turn, so the system prompt stays cacheable.
    content: i === turns.length - 1 ? `${t.text}\n\n<context>\n${context}\n</context>` : t.text,
  }));

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // If a safety classifier declines the request, the API retries it on Anthropic's
      // recommended fallback model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium", format: zodOutputFormat(Reply) },
      messages,
    });

    if (response.stop_reason === "refusal") return json(200, { error: "refused" });
    if (response.stop_reason === "max_tokens") return json(502, { error: "invalid_output", detail: "The answer was cut off." });

    const text = response.content.find(block => block.type === "text");
    if (!text || text.type !== "text") return json(502, { error: "invalid_output", detail: "The answer had no content." });
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.text);
    } catch {
      return json(502, { error: "invalid_output", detail: "The answer was not valid JSON." });
    }
    const reply = Reply.safeParse(parsed);
    if (!reply.success) return json(502, { error: "invalid_output", detail: "The answer did not match the expected form." });
    return json(200, { reply: reply.data });
  } catch (err) {
    // Most specific first. Nothing from the provider's error text is passed to the app.
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error("floor-plan-ai: the AI key was rejected");
      return json(503, { error: "not_configured" });
    }
    if (err instanceof Anthropic.RateLimitError) return json(429, { error: "rate_limited" });
    if (err instanceof Anthropic.BadRequestError) {
      console.error("floor-plan-ai: bad request", err.message);
      return json(502, { error: "server" });
    }
    if (err instanceof Anthropic.APIConnectionError) return json(504, { error: "network" });
    if (err instanceof Anthropic.APIError) {
      console.error("floor-plan-ai: API error", err.status);
      return json(502, { error: "server" });
    }
    console.error("floor-plan-ai: unexpected error", err);
    return json(500, { error: "server" });
  }
});
