# Director's Cut — AI video-production planner

Turns a one-paragraph description of a video (plus an optional transcript) into an edit plan: director's notes, chapter
markers, short-form clip ideas, per-platform export guidance, thumbnail concepts, SEO copy and SRT captions. A companion
dashboard tracks production runs and a manual publish checklist.

> Part of the **Kato.8 internal-tools suite** (ten tools plus the [`central-command`](https://github.com/Terry-Resume/central-command)
> hub), all built on [`@kato8/core`](https://github.com/Terry-Resume/kato8-core) for auth, model config and shared data.
> The public build runs in demo mode with canned, fictional results (no keys, no accounts, no model calls).

## What it does and does not do

Director's Cut **plans from text**. It does not watch or analyse the uploaded video file, so scene timestamps, scores and
duration estimates are suggested targets, not measurements of your footage. The prompts say so, and so does the Setup tab.
The dashboard's publish queue is a **manual checklist**: you post with each platform's own tools and mark the item done.
Nothing is uploaded or published for you.

## Try it (no accounts, no keys)

```bash
npm install
KATO8_DEMO=1 npm run dev        # http://localhost:5173
```

A pill at the bottom of the page switches between the four suite roles. `super_admin` and `social_media_manager` can use the
tool; `team_lead` and `member` see the "no access" screen, and the API answers `403` for them too.

## How it is built

```
browser (static HTML)  ──POST /api/generate {task, ctx, genre, platforms, transcript}──▶  Vercel function
   gate.js (Clerk UX)                                                                    ├─ verifies Clerk session + role (@kato8/core)
   renders escaped results                                                               ├─ validates and bounds every input
                                                                                         ├─ builds the prompt (server-owned)
                                                                                         └─ calls Claude (server-chosen model, capped tokens)
```

- **No key in the browser.** The old version asked each user for an Anthropic key, kept it in `localStorage` and called the
  API directly from the page. Now the key lives only in the server environment.
- **Server-owned prompts.** The browser sends a task name and the user's inputs, never a prompt, a model or a token limit, so a
  signed-in user cannot use the route as a general model proxy. User text is fenced in `<input>` tags and the model is told to
  treat it as data.
- **Fails closed.** `gate.js` used to hide the sign-in screen whenever Clerk failed to load. It now stays locked, and the
  server enforces the role regardless of what the page shows.
- **Untrusted output.** Model output is HTML-escaped once, where it is parsed, and colours are validated before they reach a
  style attribute. The test suite renders hostile payloads in jsdom and asserts nothing becomes markup or runs.
- **Pinned and configured at build time.** `build.js` takes the Clerk publishable key from the environment (the build stops if
  it is missing), pins the Clerk script version via `@kato8/core`, and writes `config.js`. No key is committed.

## API

| Route | Method | Access |
| --- | --- | --- |
| `/api/generate` | POST | `super_admin`, `social_media_manager` (from the suite registry) |
| `/api/health` | GET | public, reports check names only |

`task` is one of `director`, `chapters`, `clips`, `platforms`, `thumbnail`, `seo`, `captions`. Limits: description 600
characters, transcript 4,000, genre and platforms from fixed lists. Upstream failures return a generic `502`.

## Configuration

| Variable | Needed for |
| --- | --- |
| `CLERK_PUBLISHABLE_KEY` | build (unless `KATO8_DEMO=1`) |
| `CLERK_SECRET_KEY`, `ANTHROPIC_API_KEY` | the API at runtime |
| `ANTHROPIC_MODEL` | optional model override (defaults come from `@kato8/core`; retired ids are refused) |
| `KATO8_DEMO=1` | fictional demo; ignored automatically when `CLERK_SECRET_KEY` is set |

## Scripts

`npm run dev` · `npm test` (API rules, build output, gate, hostile-output rendering, run flow, dashboard) · `npm run lint` · `npm run build`

## Known limits

- Production Clerk sessions are checked server-side, but the demo role switcher is a UX shortcut for the public build only.
- The Clerk script is pinned to an exact version but has no Subresource Integrity hash yet.
- Run history and the publish checklist live in the browser (`localStorage`), per user and per device.

## License

MIT
