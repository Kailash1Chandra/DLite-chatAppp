# D-Lite Call Service

This service handles WebRTC signaling for audio and video calls. It does not carry voice or video streams. The browser handles media through WebRTC, and this backend only relays signaling messages between users.

## Features

- Runs on port `4003`
- Built with Node.js, Express, and Socket.IO
- Supports audio and video calls using a `callType` flag
- Handles call initiation, answer, rejection, ICE candidates, and call ending
- Keeps signaling logic simple and in memory

## Folder Structure

```text
src/
├── config/
│   └── env.js
├── controllers/
│   └── callController.js
├── services/
│   └── callStateService.js
├── sockets/
│   └── callSocket.js
└── server.js
```

## Socket Events

### `call_user`

Starts a call and sends the initial WebRTC offer to the other user.

```json
{
  "callId": "optional-call-id",
  "toUserId": "user-2",
  "callType": "video",
  "offer": {
    "type": "offer",
    "sdp": "..."
  }
}
```

### `accept_call`

Accepts a call and returns the WebRTC answer.

```json
{
  "callId": "call-123",
  "answer": {
    "type": "answer",
    "sdp": "..."
  }
}
```

### `reject_call`

Rejects an incoming call.

```json
{
  "callId": "call-123",
  "reason": "busy"
}
```

### `ice_candidate`

Sends ICE candidates between peers.

```json
{
  "callId": "call-123",
  "toUserId": "user-2",
  "candidate": {
    "candidate": "...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

### `end_call`

Ends an active call.

```json
{
  "callId": "call-123",
  "reason": "hangup"
}
```

## WebRTC Flow

1. User A connects to Socket.IO with a `userId` in the handshake.
2. User B also connects with a `userId`.
3. User A creates an `RTCPeerConnection` and generates an offer.
4. User A emits `call_user` with `toUserId`, `callType`, and `offer`.
5. The service forwards `call_user` to User B.
6. User B sets the remote description, creates an answer, and emits `accept_call`.
7. The service forwards `accept_call` back to User A.
8. Both users exchange `ice_candidate` events until the peer connection is established.
9. Either user can emit `end_call` to finish the call.

## Important Note

This service does not stream audio or video.

- WebRTC peer connections handle media directly between clients
- This backend only forwards signaling data

## Environment Variables

Create a `.env` file inside `D-Lite-call-service`:

```env
PORT=4003
CORS_ORIGINS=http://localhost:4000,http://localhost:3000,http://localhost:5173
```

## Run Locally

```bash
npm install
npm run dev
```

For production:

```bash
npm start
```
