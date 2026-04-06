# D-Lite API Gateway

This service is the single entry point for the D-Lite microservices system. It accepts client requests on port `4000` and forwards them to the correct backend service using `http-proxy-middleware`.

## Features

- Built with Node.js and Express
- Uses ES modules (`import` / `export`)
- Adds CORS and JSON body parsing
- Logs incoming requests
- Proxies requests to the right microservice
- Returns simple error responses when something goes wrong

## Folder Structure

```text
D-Lite-api-gateway/
├── package.json
├── README.md
└── src/
    ├── app.js
    ├── server.js
    ├── config/
    │   └── env.js
    ├── middleware/
    │   ├── errorHandler.js
    │   └── logger.js
    └── proxies/
        └── serviceProxies.js
```

## Route Proxies

The gateway listens on `http://localhost:4000` and forwards requests like this:

- `/auth` -> `http://localhost:4001`
- `/chat` -> `http://localhost:4002`
- `/call` -> `http://localhost:4003`
- `/media` -> `http://localhost:4004`

Example:

- Request to `GET http://localhost:4000/auth/health`
- Forwarded to `GET http://localhost:4001/health`

The `/auth`, `/chat`, `/call`, and `/media` prefixes are removed before the request is sent to the target service.

## Environment Variables

Create a `.env` file inside this service folder if you want to override defaults.

```env
GATEWAY_PORT=4000
GATEWAY_CORS_ORIGIN=*
AUTH_SERVICE_URL=http://localhost:4001
CHAT_SERVICE_URL=http://localhost:4002
CALL_SERVICE_URL=http://localhost:4003
MEDIA_SERVICE_URL=http://localhost:4004
```

## Install and Run

```bash
npm install
npm run dev
```

For production:

```bash
npm start
```

## How It Works

1. The Express app starts on port `4000`.
2. Middleware handles CORS, JSON parsing, and request logging.
3. Requests that start with `/auth`, `/chat`, `/call`, or `/media` are proxied to the matching service.
4. If a route does not exist, the gateway returns a `404` response.
5. If a proxy or server error happens, the gateway returns a simple JSON error response.
