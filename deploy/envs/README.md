# Deploy env templates (Render / Vercel)

This folder contains **copy-paste environment variable templates** for deploying each D-LITE service separately.

## Files

- `core-backend.env.example` → set these variables on **core-backend** (FastAPI REST)
- `realtime-service.env.example` → set these variables on **realtime-service** (Socket.IO)
- `worker-service.env.example` → set these variables on **worker-service** (backups)
- `frontend-service.env.example` → set these variables on **frontend-service** (Next.js)

Generated (ready-to-paste) templates:

- `core-backend.env`
- `realtime-service.env`
- `worker-service.env`
- `frontend-service.env`

## How to use (Render / Vercel)

- **Render**: Dashboard → your service → **Environment** → add variables from the matching file.
- **Vercel** (frontend): Project → **Settings → Environment Variables** → add variables from `frontend-service.env.example`, then **redeploy**.

Notes:
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.
- `NEXT_PUBLIC_*` values are public and are embedded at build time; changing them requires a new deployment.
 - `AUTH_JWT_SECRET` in `core-backend.env` and `realtime-service.env` is pre-generated and must **match** across backend services.

