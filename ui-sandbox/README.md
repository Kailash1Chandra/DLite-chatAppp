## D-Lite UI Sandbox (frontend + fake server)

This folder is a **standalone UI testing sandbox**. It contains:

- `frontend/`: a copy of the real `frontend-service` (no `node_modules/` or `.next/`)
- `mock-server/`: a fake API (`:4100`) + fake Socket.IO server (`:4103`)

### Run (2 terminals)

1) Start fake API + sockets:

```bash
cd ui-sandbox/mock-server
npm install
PORT=4100 npm run dev:api
```

In another terminal:

```bash
cd ui-sandbox/mock-server
SOCKET_PORT=4103 npm run dev:sockets
```

2) Start the sandbox frontend:

```bash
cd ui-sandbox/frontend
npm install
npx next dev -p 3002
```

Open `http://localhost:3002`.

### Mock login

Use any email. First create an account:

- Register: any `username`, `email`, `password`

Then login with the same email/password.

