# GymTracker

A small fitness app for tracking workouts, diet, hydration, and BMI with friends. Built with React + Vite + TypeScript on top of Supabase.

## Features

- **Workouts** — log push/pull/legs/core sessions with sets, reps, weight; presets for the common splits.
- **Body diagram** — front + back muscle map that color-codes muscles by how recently they were trained (driven by a SQL view).
- **Diet logging** — meals with macros and photo proof (Supabase Storage).
- **Hydration** — daily glass counter with a weekly chart, upserted on `(user_id, log_date)`.
- **BMI tracker** — height/weight history with trend, body-fat %, and a healthy-range badge.
- **Leaderboard** — pulled from a SQL view that scores streak + log volume.
- **Roles** — `user`, `admin`, `super_admin`. Admin pages are RLS-protected and only super admins can promote others.
- **Auth** — email/password via Supabase, with custom access token hook baking the role into the JWT.

## Stack

- React 19, TypeScript, Vite 8
- Tailwind CSS v4
- Supabase (Auth, Postgres, Storage)
- React Router v7, lucide-react icons, date-fns

## Getting started

```bash
npm install
cp .env.example .env       # fill in your Supabase URL + publishable key
npm run dev
```

The app expects two env vars:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

The full database schema (profiles, diet_logs, hydration_logs, workouts, workout_exercises, exercises, bmi_logs, goals, leaderboard view, muscle_activity view, RLS policies, storage buckets) is not in this repo — set it up in your own Supabase project.

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — type-check then build
- `npm run lint` — ESLint
- `npm run preview` — serve the production build
