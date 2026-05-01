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
- Vercel deployment prep

Trackdog is not yet fully online because it still needs:
- hosted database migration strategy
- production deployment wiring
- per-user or role-based backend/data authorization strategy

## Next implementation phases
1. GitHub source-of-truth setup
2. Vercel deployment
3. SQLite to Supabase/Postgres migration
4. per-user or role-based authorization strategy
5. production hardening
