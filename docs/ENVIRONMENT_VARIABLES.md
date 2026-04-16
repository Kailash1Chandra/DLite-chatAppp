# Environment variables (Supabase Auth setup)

This project is configured to use **Supabase Auth** (no local-auth fallback).

## Common Supabase variables (backend services)

- **`SUPABASE_URL`**: your project URL (example: `https://xxxxx.supabase.co`)
- **`SUPABASE_ANON_KEY`**: anon/public key (safe to use in client, but here used server-side too)
- **`SUPABASE_SERVICE_ROLE_KEY`**: service role key (**server-only**) for privileged writes (required for some server endpoints)

## `core-backend` (FastAPI REST)

### Required
- **`PORT`**: default `4000`
- **`CORS_ORIGINS`**: comma-separated allowed origins (example: `https://app.example.com`)
- **`SUPABASE_URL`**
- **`SUPABASE_ANON_KEY`**

### Recommended
- **`SUPABASE_SERVICE_ROLE_KEY`**: required for `POST /chat/groups/ensure` (server-side writes)

## `realtime-service` (Socket.IO)

### Required
- **`PORT`**: default `4003`
- **`SOCKET_IO_CORS_ORIGINS`**: `*` or comma-separated list of allowed origins
- **`SUPABASE_URL`**
- **`SUPABASE_ANON_KEY`**

## `frontend-service` (Next.js)

### Required (public)
- **`NEXT_PUBLIC_API_BASE_URL`**: where `core-backend` is reachable
- **`NEXT_PUBLIC_CHAT_SOCKET_URL`**: where `realtime-service` is reachable
- **`NEXT_PUBLIC_CALL_SOCKET_URL`**: usually same as chat socket URL
- **`NEXT_PUBLIC_SUPABASE_URL`**
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**

