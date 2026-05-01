# Trackdog

Trackdog is a mobile-first work order and hourly tracking app for White Oaks field operations.

## Current stack
- React + Vite frontend
- Express API
- SQLite local database
- jsPDF export flow

## Local development

### 1. Install
```bash
npm install
```

### 2. Configure env
Copy `.env.example` to `.env` and adjust as needed.

Example:
```bash
cp .env.example .env
```

### 3. Run locally
```bash
npm run dev
```

This starts:
- frontend dev server
- backend API server

Typical local URLs:
- frontend: `http://localhost:5173` or next available Vite port
- API: `http://localhost:3001`

## Environment variables
- `VITE_API_BASE_URL` - frontend API base URL
- `VITE_TRACKDOG_RECORDS_FOLDER` - display/default records folder label for UI
- `VITE_SUPABASE_URL` - Supabase project URL for frontend auth and backend token verification
- `VITE_SUPABASE_ANON_KEY` - Supabase publishable key, safe for frontend use, also used by backend token verification
- `TRACKDOG_RECORDS_FOLDER` - backend folder used for PDF save/export
- `PORT` - backend API port

## Quality checks
```bash
npm run build
npm run lint
```

## Supabase auth setup
Trackdog now includes an initial Supabase login gate.

Add these values to `.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Behavior:
- if Supabase env vars are present, Trackdog requires sign-in before loading the app
- the Express API now also requires a valid Supabase bearer token when Supabase is configured
- if Supabase env vars are missing, Trackdog still runs in local dev mode without auth
- invited/manual users should be created in Supabase Auth, with public signup left disabled

## Current readiness status
Trackdog is now prepared for:
- GitHub baseline cleanup
- environment-based API configuration
- initial Supabase auth integration
- backend API token enforcement
- Vercel deployment prep

Trackdog is not yet fully online because it still needs:
- hosted database migration strategy
- production deployment wiring
- per-user or role-based backend/data authorization strategy

## Deployment notes
For a hosted deployment, this app currently has two parts:
- Vite frontend
- Node/Express backend with a local SQLite database

Important constraint:
- Vercel is fine for the frontend, but the current backend and SQLite storage are not a good long-term fit for Vercel serverless hosting as-is.
- For a real hosted setup, plan to move data storage to Supabase/Postgres and either move the API into hosted functions carefully or run it on a persistent Node host.

Minimum hosted env vars:
- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `TRACKDOG_RECORDS_FOLDER` if PDF saving remains filesystem-based on the backend host
- `PORT` for non-serverless backend hosting

## Vercel frontend readiness
The frontend now builds cleanly for Vercel, but it needs these Vercel project env vars set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL` set to the full deployed backend URL, not `/api`

If `VITE_API_BASE_URL` is missing in a hosted environment, the UI now shows a clear configuration error instead of silently failing.

## Next implementation phases
1. choose deployment shape: Vercel frontend + separate API host, or full migration first
2. SQLite to Supabase/Postgres migration
3. move PDF/archive storage off local filesystem if hosting remotely
4. per-user or role-based authorization strategy
5. production hardening
