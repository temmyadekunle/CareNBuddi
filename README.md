# HealthLink

A personal health dashboard built with Next.js (App Router), React, TypeScript, and Tailwind CSS.

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