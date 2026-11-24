# floor-plan-ai

Server side of **AI Design** in the Mistry floor planner. The app sends the chat and a summary
of the current plan; this function asks Claude for a structured room layout and returns it as
JSON. The app validates the layout again before it is previewed, and nothing is drawn until
the user taps Apply.

The AI key stays here, as a Supabase secret. It is never sent to the app.

## Set up

1. Get an Anthropic API key from https://console.anthropic.com.
2. Store it as a secret and deploy the function:

   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy floor-plan-ai
   ```

3. Tell the app the function exists, in the build environment (`.env` or the host's settings):

   ```
   VITE_AI_DESIGN_FUNCTION=floor-plan-ai
   ```

   Without this line the app does not call any AI. AI Design then uses the built-in layout
   rules and says so on screen.

## Who can call it

Only users signed in to Supabase (Account → cloud backup in the app). A request without a
valid session gets `401 not_signed_in`. There is no per-user quota yet: add one before opening
the app to many users, because every request is billed to the key.

## What it sends and returns

Request body:

```json
{ "turns": [{ "role": "user", "text": "30 × 40 ft, 2 BHK" }],
  "context": { "unit": "feet", "plot": { "width": 30, "depth": 40 }, "currentPlan": "empty" } }
```

Response `200`:

```json
{ "reply": { "kind": "plan", "message": "...", "questions": [], "assumptions": ["..."],
             "plan": { "unit": "feet", "plot": { "width": 30, "depth": 40 },
                       "rooms": [], "doors": [], "windows": [] } } }
```

`kind` is `plan`, `question` (the model needs the plot size or the rooms) or `message`.

Errors are `{ "error": "<code>" }` with one of `not_signed_in` (401), `not_configured` (503,
no key or the key was rejected), `rate_limited` (429), `too_long` (413), `invalid_output`
(502), `network` (504), `server` (500/502), or `refused` (200, the model declined).

## Model

`claude-opus-5-5`, structured output, medium effort. If a safety classifier declines a
request, the API retries it on Anthropic's recommended fallback model in the same call
(`fallbacks: "default"`). To use a cheaper model, change `MODEL` in `index.ts`.

## Not verified

This function was type-checked against `@anthropic-ai/sdk` 0.133.0 but has not been deployed
or run against the live API from this repository. Test it with a real key before relying on it.
