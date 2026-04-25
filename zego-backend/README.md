## dlite-zego-backend

Clean, production-structured backend for **ZEGOCLOUD** token generation and simple room management.

### Features

- **Express** server with CORS + JSON middleware
- **JWT auth** middleware (`Authorization: Bearer <token>`)
- **ZEGOCLOUD Token04 generation** (server-side only; secret never exposed)
- **In-memory room map** (`roomID → users[]`) with create/join/leave
- **Rate limiting** and **request logging**

### Setup

1. Install deps

```bash
cd zego-backend
npm install
```

2. Configure env

```bash
cp .env.example .env
```

Fill:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose)
- `ZEGO_APP_ID`
- `ZEGO_SERVER_SECRET` (32 chars)
- `PORT` (default `5000`)

3. Run

```bash
npm run dev
# or
npm start
```

Health check: `GET /health`

### Auth

Send a **Supabase JWT** in:

- `Authorization: Bearer <JWT>`

The backend validates it using `supabase.auth.getUser(token)` and attaches the Supabase user to `req.user`.

### API

#### Generate ZEGO token (1 hour expiry)

`POST /api/zego/token`

Notes:
- `userID` is **never accepted from frontend**.
- Backend uses `req.user.id` as `userID` and `req.user.email` (or metadata) as username seed.

Response:
```json
{ "ok": true, "token": "...", "appID": 123, "userID": "uuid" }
```

#### Create room

`POST /api/room/create`

Body:
```json
{ "roomID": "string" }
```

#### Join room

`POST /api/room/join`

Body:
```json
{ "roomID": "string" }
```

#### Leave room

`POST /api/room/leave`

Body:
```json
{ "roomID": "string" }
```

#### Get room (debug)

`GET /api/room/:roomID`

### Security rules implemented

- **Server secret is never returned**
- **Only backend generates tokens**
- Token expiry fixed to **1 hour**
- **Supabase JWT required** for protected APIs

