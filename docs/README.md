## D-Lite backend setup (fresh rebuild)

- **DB schema**: apply `database/schema.sql` in Supabase SQL editor.
- **core-backend**: FastAPI service that proxies Supabase Auth endpoints and reads/writes chat data via PostgREST.
- **realtime-service**: Socket.IO service that validates Supabase access tokens and broadcasts realtime chat events.

Frontend lives in `frontend-service/` (kept as-is).

