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

### Chat media (Cloudinary, server-only)

Required for `POST /chat/media/upload` (DM/group image and file uploads):

- **`CLOUDINARY_CLOUD_NAME`**: cloud name from the Cloudinary dashboard
- **`CLOUDINARY_API_KEY`**: API key
- **`CLOUDINARY_API_SECRET`**: API secret (never expose to the browser; keep on `core-backend` only)

Uploads are stored under folder `d_lite_chat/<user_id>/`.

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

### WebRTC / calls (public)

- **`NEXT_PUBLIC_ICE_SERVERS_JSON`**: JSON array passed to `RTCPeerConnection` (`iceServers`). Default in code is Google STUN only. **Restart `next dev` / rebuild after changing this** (Next inlines `NEXT_PUBLIC_*` at build time).
  - **LAN / quick tests**: `[{"urls":["stun:stun.l.google.com:19302"]}]` (same as root `.env.example`).
  - **Many mobile or strict NAT networks**: add a **TURN** server (e.g. coturn, Twilio, Cloudflare) so media can relay when UDP peer-to-peer fails. If the browser shows *ICE failed, add a TURN server*, you are in this case. Example shape (UDP + TLS; match ports to your coturn config):
    - `[{"urls":["stun:stun.l.google.com:19302"]},{"urls":["turn:turn.example.com:3478","turns:turn.example.com:5349"],"username":"your-user","credential":"your-secret"}]`
  - Keep secrets out of git; set in deployment env or `.env.local`.

#### Deploy checklist (e.g. Vercel + Render)

- **Socket.IO**: Set `NEXT_PUBLIC_CHAT_SOCKET_URL` / `NEXT_PUBLIC_CALL_SOCKET_URL` to your Render **HTTPS** origin (e.g. `https://dlite-chatapp.onrender.com`). On Render, set **`SOCKET_IO_CORS_ORIGINS`** to include your Vercel URL (e.g. `https://frontend-dlite.vercel.app`) so polling and WebSocket upgrades are allowed.
- **TURN “appears broken” in Firefox**: Usually means relay candidates failed (not missing). Verify: **valid TLS** for `turns:` (no self-signed without trust), **static username/password** match `coturn`, **listening ports** reachable from the public internet, and **both peers** get the same `NEXT_PUBLIC_ICE_SERVERS_JSON` after redeploy. Use **about:webrtc** → connection log for `relay` / error lines.

### Optional: Mongo message mirror (`frontend-service`)

If you use `POST /api/message-backup`, set:

- **`MONGODB_URI`** (server-side; optional `NEXT_PUBLIC_MONGODB_URI` for legacy)
- **`MONGODB_DB_NAME`** (optional)

