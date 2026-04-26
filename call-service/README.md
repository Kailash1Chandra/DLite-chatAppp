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
- `INVITE_TIMEOUT_MS` (default `30000`)
- `NODE_ENV` (set to `production` in prod)

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

### Call lifecycle (Socket.IO)

Client → Server events:

- `call:start` `{ calleeID, type: "audio"|"video" }` → ack `{ ok, roomID, expiresAt }`
- `call:accept` `{ roomID }` → ack `{ ok, roomID }`
- `call:reject` `{ roomID, reason?: "declined"|"busy"|"other" }` → ack `{ ok, roomID }`
- `call:cancel` `{ roomID }` → ack `{ ok, roomID }`
- `call:end` `{ roomID }` → ack `{ ok, roomID }`

Server → Client events:

- `call:incoming` `{ roomID, caller: { userID, displayName, avatar? }, type, expiresAt }`
- `call:accepted` `{ roomID, by: userID }`
- `call:rejected` `{ roomID, by: userID, reason }`
- `call:cancelled` `{ roomID, by: userID }`
- `call:ended` `{ roomID, endedBy: userID, durationSeconds }`
- `call:missed` `{ roomID, callee: userID, type }`
- `call:timeout` `{ roomID }`

Error codes (ack `ok:false`):

- `BAD_REQUEST`
- `USER_NOT_FOUND`
- `USER_OFFLINE`
- `USER_BUSY`
- `ROOM_NOT_FOUND`
- `FORBIDDEN`
- `INVALID_STATE`
- `NOT_INVITED`
- `INTERNAL`

Call flow (ASCII):

```
Caller                        Server                          Callee
  | call:start(callee,type)     |                               |
  |---------------------------->| validate + create room         |
  |<----------- ack(ok,roomID)--| emit call:incoming             |
  |                              |------------------------------>|
  |                              | 30s timeout timer starts      |
  | call:accept(roomID)?         |                               |
  |<-----------------------------| callee emits call:accept       |
  | emit call:accepted           |                               |
  |<---------------------------->|------------------------------>|
  | (room becomes active)        |                               |
  | call:end(roomID)             |                               |
  |----------------------------->| emit call:ended               |
  |<---------------------------->|------------------------------>|
```

### Testing manually

1. Start the service:

```bash
cd call-service
cp .env.example .env
npm install
npm run dev
```

2. Open 2 browser tabs and connect Socket.IO with two different Supabase JWTs.

3. Scenarios:
- A calls B → B receives `call:incoming`
- B accepts → both get `call:accepted`
- B rejects → A gets `call:rejected`
- A cancels ringing → B gets `call:cancelled`
- No answer for 30s → A gets `call:missed` and B gets `call:timeout`
- Active call end → both get `call:ended`
- Refresh/disconnect tab mid ringing/active → expect cancel/reject/end behavior

### Notes

- **Security**: `userID` is never accepted from frontend; always derived from Supabase JWT (`req.user.id`).
- **Room store** is in-memory (`Map`), so restarting the service clears rooms. This is intentional for simplicity; later you can swap for Redis/DB.

