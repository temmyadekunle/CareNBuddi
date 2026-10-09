# CareNBuddi

A personal health navigation system built with Next.js (App Router), React, TypeScript, and Tailwind CSS.

**Slogan:** Your Health, Your Buddi

## Features

- **Dashboard** — charts for mood, heart rate, weight, and sleep using Recharts
- **Health journal** — log mood, symptoms, vitals, and notes per day
- **Medical records** — archive of visits, labs, imaging, prescriptions, and vaccinations with optional links, filterable by category
- **Reminders** — recurring reminders for medication, hydration, activity, and appointments

## Data

All data is stored locally in the browser via `localStorage`. The app seeds sample data on first load so every page is populated out of the box.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev      # development server
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint
```

## AI Health Guide

The **CareNBuddi Health Guide** (Home card → in-app chat panel) interprets
natural-language care requests through a server-side endpoint,
`POST /api/health-guide`, implemented in `worker/index.ts` and deployed with the
site by Wrangler (`wrangler.jsonc`: `main`, `assets.binding = ASSETS`,
`run_worker_first: ["/api/*"]`). The model only classifies intent, category and
location — provider results are always read from the app's own provider
directory (the same data Find Care uses), so nothing is ever invented.

### Configuration (server-side only)

All AI configuration lives in Cloudflare, never in the frontend bundle:

```bash
# OpenAI-compatible API key, stored as a Worker secret
npx wrangler@4 secret put AI_API_KEY
```

Optional `wrangler.jsonc` `vars` (defaults shown):

- `AI_BASE_URL` — OpenAI-compatible base URL (`https://api.openai.com/v1`)
- `AI_MODEL` — model id (`gpt-4o-mini`)

Any OpenAI-compatible provider works via `AI_BASE_URL`.

### Behaviour without a key (by design)

- On the Cloudflare deployment with no `AI_API_KEY`, the endpoint returns
  `{ok:true, configured:false}` and the app shows an honest “assistant not
  connected” message with a Find Care shortcut — it never pretends the AI works.
- On static-only hosts (e.g. Vercel) the endpoint 404s and the app shows the
  same honest fallback.

### Privacy & safety

- No transcripts, names or health details are stored or logged server-side —
  the Worker emits status codes only.
- Guide analytics are aggregated per-device counters in `localStorage`
  (`healthlink:guide-events`); see `lib/analytics.ts` for the event list and
  documented limitations.
- Emergency messages are caught by deterministic checks **before** any AI call
  (client pre-check + a second check in the Worker); the user sees the app's own
  fixed guidance (call 112, `/emergency`) — never model-generated triage.

### Local testing

```bash
npm run build
npx wrangler@4 dev        # serves out/ plus /api/health-guide on :8787

curl -s http://localhost:8787/api/health-guide \
  -H "content-type: application/json" \
  -d "{\"message\":\"find a doctor in Lagos\",\"history\":[]}"
```

## Project structure

```
app/
  page.tsx          Dashboard
  journal/page.tsx  Health journal
  records/page.tsx  Medical records
  reminders/page.tsx Reminders
components/
  nav.tsx           App navigation
lib/
  types.ts          Shared types & constants
  storage.ts        localStorage-backed data store
  format.ts         Formatting helpers
```