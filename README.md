# D-LITE

D-LITE is a real-time chat + calling app with a modern Next.js frontend and a multi-backend architecture for chat, realtime signaling, and AI features.

## What’s in this repo

- **frontend-service**: Next.js web app (UI + internal API routes)
- **core-backend**: FastAPI REST backend for auth, chat, groups, media upload
- **realtime-service**: Socket.IO backend for realtime chat + call signaling
- **ai-backend**: FastAPI AI backend (chat,voice-chat(coming-soon))
- **database/docs**: SQL schema + deployment/environment docs

## Features

### Authentication
- **Sign up / Log in** — email-based registration and login via Supabase Auth
- **Protected routes** — all chat pages are behind an auth guard; unauthenticated users are redirected to `/login`
- **Session persistence** — auth state is managed globally via `AuthContext` and survives page refreshes

### Direct (DM) Chat
- **Real-time messaging** — messages appear instantly via Socket.IO; no page refresh needed
- **Recent chats sidebar** — lists your active conversations sorted by latest activity
- **Start new chat** — search any registered user by username and open a DM instantly
- **Filter conversations** — live search bar to filter your chats list
- **Typing indicators** — see when the other person is typing
- **Online presence** — see whether a contact is online or offline
- **Message reactions** — hover a message and react with an emoji (👍 ❤️ 😂 etc.)
- **Pin / unpin messages** — pin important messages; pinned messages are highlighted and accessible from the conversation header
- **Delete messages** — remove your own messages; deleted messages show a placeholder
- **Media sharing** — send images, videos, audio files, and generic file attachments; previews render inline
- **Link preview** — pasted URLs are enriched with a title/description card via `/api/link-preview`
- **Polls** — compose an informal poll with up to three options; poll cards render inline in the chat thread
- **Export chat history** — download the full conversation as a JSON file
- **Message backup** — optional MongoDB-backed backup via `/api/message-backup`
- **User avatars** — auto-generated DiceBear avatars based on username; no manual upload needed

### Group Chat
- **Create groups** — pick a name, set a group photo, and invite members in a two-step flow
- **Add / kick members** — admins can search for users and add them, or remove existing members
- **Admin roles** — the group creator is an admin; regular members have limited permissions
- **Real-time group messages** — all members see new messages live via Socket.IO
- **Group typing indicators** — see who in the group is currently typing
- **Message reactions** — same emoji reaction system as DM, scoped per group message
- **Pin / unpin messages** — admins and members can pin notable messages in the group
- **In-conversation message search** — filter messages within the active group by keyword
- **Mute notifications** — toggle notification muting per group
- **Group photo upload** — upload a group avatar image (stored via Cloudinary)
- **Export / import chat history** — export a group's messages as JSON, or re-import a previously exported file
- **Leave group** — any member can leave; admins can also delete the group entirely

### Calls
- **Video / voice calls** — browser-based calls powered by WebRTC signaling over `realtime-service`
- **Incoming call overlay** — a full-screen overlay pops up with accept / decline when someone calls you
- **Hosted call rooms** — shareable call rooms via ZEGOCLOUD when the `token` API is configured
- **Call history** — recent call records are tracked client-side via `callHistory`

### AI — Special Friend
- **Chat mode** — have a freeform text conversation with an AI assistant; responses stream from `ai-backend`
- **Voice mode** — speak into your microphone (speech-to-text via Deepgram), get a spoken AI reply (text-to-speech via ElevenLabs); a live audio-level visualiser shows mic activity
- **Mode picker** — switch between chat and voice mode from the Special Friend entry point

### UI / UX
- **Dark / light theme** — toggle between themes; preference is persisted via `ThemeContext`
- **Virtualized message lists** — long conversations use `@tanstack/react-virtual` so only visible messages are rendered, keeping the UI fast regardless of history length
- **Linkified messages** — plain-text URLs in messages are automatically turned into clickable links
- **Responsive layout** — sidebar collapses on narrow viewports; works on mobile browsers
- **Composer overflow menu** — extra send actions (poll, media, etc.) are tucked behind a `+` button in the message composer

## Feature map (service routing)

- **Auth**: Supabase Auth via `core-backend` (`/auth/*`)
- **Direct & Group chat**: REST (`core-backend`) + Socket.IO realtime (`realtime-service`)
- **Calls**: WebRTC signaling on `realtime-service`
- **Media uploads**: Cloudinary via `core-backend` (`/chat/media/upload`)
- **AI assistant (Special Friend)**: `ai-backend` via `/api/v1/chat`

## Architecture (high level)

```text
Browser (Next.js)
  ├─ UI routes (/login, /dashboard, /groups, /special-friend, /call, ...)
  ├─ Internal API routes
  │    ├─ /api/link-preview
  │    ├─ /api/message-backup (optional Mongo)
  │    └─ /api/token (ZEGOCLOUD when configured)
  ├─ REST -> core-backend
  │    ├─ /auth/*
  │    └─ /chat/*
  ├─ Socket.IO -> realtime-service
  │    ├─ chat events
  │    └─ call signaling events
  └─ AI -> ai-backend
       └─ /api/v1/* (chat,voice-chat)
```

## Local services & default ports

- `frontend-service`: `http://localhost:3000`
- `core-backend`: `http://localhost:4000`
- `realtime-service`: `http://localhost:4003`
- `ai-backend`: `http://localhost:8000`

## Repo structure

```text
frontend-service/        # Next.js frontend
core-backend/            # FastAPI auth/chat/media
realtime-service/        # Socket.IO realtime + signaling
ai-backend/              # FastAPI AI endpoints (chat/STT/TTS)
database/                # SQL and data assets
docs/                    # Deployment and env docs
.env.example             # Root env template
```

## Quick start (local)

### 1) Prepare env

- Copy `.env.example` to `.env` at repo root
- Fill required Supabase values (`SUPABASE_URL`, `SUPABASE_ANON_KEY`)
- Add optional integrations if needed (Cloudinary, AI provider keys)

### 2) Run frontend

```bash
cd frontend-service
npm install
npm run dev
```

### 3) Run core backend

```bash
cd core-backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 4000
```

### 4) Run realtime backend

```bash
cd realtime-service
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 4003
```

### 5) Run AI backend

```bash
cd ai-backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Environment variables

For full deployment guidance, see `docs/ENVIRONMENT_VARIABLES.md`.

### Frontend (public)

- `NEXT_PUBLIC_API_BASE_URL` (core-backend origin)
- `NEXT_PUBLIC_CHAT_SOCKET_URL` (realtime-service origin)
- `NEXT_PUBLIC_CALL_SOCKET_URL` (usually same as chat socket origin)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_AI_BACKEND_URL` (optional; defaults to `https://dlite-ai.onrender.com` in Special Friend)

### Core backend

- Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- Recommended: `SUPABASE_SERVICE_ROLE_KEY` (for group/admin write flows)
- Optional media: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### Realtime backend

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `SOCKET_IO_CORS_ORIGINS`

### AI backend

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (example: `nvidia/nemotron-3-super-120b-a12b:free`)
- `DEEPGRAM_API_KEY` (STT)
- `ELEVENLABS_API_KEY` (TTS)
- `ELEVENLABS_VOICE_ID`

## API quick reference

### Core backend

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `GET /chat/messages/{chatId}`
- `POST /chat/messages/send`
- `POST /chat/media/upload`

### AI backend (prefix: `/api/v1`)

- `GET /health`
- `POST /chat`
- `POST /speech-to-text`
- `POST /text-to-speech`
- `POST /voice-chat`

## Health checks (smoke test)

```bash
curl -sS http://localhost:3000/health
curl -sS http://localhost:4000/health
curl -sS http://localhost:4003/health
curl -sS http://localhost:8000/api/v1/health
```

## Troubleshooting

- **Group/direct chat issues**
  - Verify `NEXT_PUBLIC_API_BASE_URL` points to `core-backend`
  - Verify `NEXT_PUBLIC_CHAT_SOCKET_URL` points to `realtime-service`
- **Media upload fails**
  - Ensure Cloudinary vars are set on `core-backend`
- **Special Friend returns fallback/local reply**
  - Verify `NEXT_PUBLIC_AI_BACKEND_URL` and `ai-backend` `/api/v1/chat` health
- **TTS fails with 401**
  - Re-check `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` on `ai-backend`
