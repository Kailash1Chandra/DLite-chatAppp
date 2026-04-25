## call-service (standalone)

Independent microservice for:
- Supabase JWT authentication
- ZEGOCLOUD Token04 generation (server-side only)
- In-memory call room management

### Why this is standalone

This service has **no dependency on the main chat backend**. It only needs:
- Supabase project (Auth)
- ZEGOCLOUD credentials

### Setup

```bash
cd call-service
cp .env.example .env
npm install
npm run dev
```

### Environment

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; do not expose)
- `ZEGO_APP_ID`
- `ZEGO_SERVER_SECRET` (32 chars)
- `PORT` (default `6000`)
- `ALLOWED_ORIGINS` (comma-separated; optional)

### API

#### Health

`GET /health`

```json
{ "status": "ok", "service": "call-service" }
```

#### Get ZEGO token

`POST /api/token` (protected)

Headers:
- `Authorization: Bearer <Supabase JWT>`

Response:
```json
{ "ok": true, "token": "...", "appID": 123, "userID": "uuid" }
```

#### Create room

`POST /api/rooms` (protected)

Body:
```json
{ "roomID": "my-room-1" }
```

#### Join room

`POST /api/rooms/join` (protected)

Body:
```json
{ "roomID": "my-room-1" }
```

#### Leave room

`POST /api/rooms/leave` (protected)

Body:
```json
{ "roomID": "my-room-1" }
```

#### Invite user to room (turn 1:1 into group)

`POST /api/rooms/invite` (protected)

Body:
```json
{ "roomID": "my-room-1", "inviteeUserID": "uuid" }
```

Response:
```json
{ "ok": true, "roomID": "my-room-1", "inviteeUserID": "uuid", "delivered": true }
```

### Realtime (Socket.IO)

Socket server is available on the same host/port.

Client must connect with Supabase JWT:

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:6000", {
  auth: { token: supabaseAccessToken },
});

socket.on("room:invite", ({ roomID, invitedBy }) => {
  // Show UI prompt and on accept navigate to /call/<roomID>?mode=video|audio
});
```

Join a room channel to receive member updates:

```js
socket.emit("room:join", { roomID });
socket.on("room:membersUpdated", ({ roomID, users }) => {});
```

### Notes

- **Security**: `userID` is never accepted from frontend; always derived from Supabase JWT (`req.user.id`).
- **Room store** is in-memory (`Map`), so restarting the service clears rooms. This is intentional for simplicity; later you can swap for Redis/DB.

