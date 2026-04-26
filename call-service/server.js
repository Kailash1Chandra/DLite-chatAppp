require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { apiRateLimiter } = require("./src/middlewares/rateLimit");
const { requestIdMiddleware } = require("./src/middlewares/requestId");
const { errorHandler, notFoundHandler } = require("./src/middlewares/errorHandler");
const { corsOptions } = require("./src/utils/corsOptions");
const apiRoutes = require("./src/routes");
const { initSocketServer } = require("./src/socket/socketServer");

const PORT = Number(process.env.PORT || 6000);

const app = express();
const server = http.createServer(app);

app.disable("x-powered-by");
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(requestIdMiddleware);
app.use(morgan(":method :url :status :res[content-length] - :response-time ms :req[x-request-id]"));
app.use(apiRateLimiter);

app.get("/favicon.ico", (_req, res) => {
  // Avoid noisy 404s in browser devtools.
  res.status(204).end();
});

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "call-service",
    health: "/health",
    apiBase: "/api",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "call-service" });
});

app.use("/api", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// Socket.IO (optional realtime)
const { io, emitToUser, shutdown: shutdownSockets } = initSocketServer(server);
app.set("io", io);
app.set("emitToUser", emitToUser);

server.listen(PORT, () => {
  console.log(`call-service listening on :${PORT}`);
});

function ts() {
  return new Date().toISOString()
}

let shuttingDown = false

async function gracefulShutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  const startedAt = Date.now()
  console.log(`[shutdown] begin`, { ts: ts(), signal })

  // Stop accepting new connections
  let serverClosed = false
  try {
    server.close(() => {
      serverClosed = true
      console.log(`[shutdown] http server closed`, { ts: ts() })
    })
  } catch (e) {
    console.error(`[shutdown] server.close failed`, { ts: ts(), err: e?.message || String(e) })
  }

  // Disconnect sockets
  try {
    if (typeof shutdownSockets === "function") shutdownSockets("server_shutdown")
  } catch (e) {
    console.error(`[shutdown] socket shutdown failed`, { ts: ts(), err: e?.message || String(e) })
  }

  const timeoutMs = 10_000
  const pollMs = 250

  while (Date.now() - startedAt < timeoutMs) {
    if (serverClosed) {
      console.log(`[shutdown] complete`, { ts: ts(), ms: Date.now() - startedAt })
      process.exit(0)
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, pollMs))
  }

  console.error(`[shutdown] timeout`, { ts: ts(), ms: Date.now() - startedAt })
  process.exit(1)
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
process.on("SIGINT", () => gracefulShutdown("SIGINT"))

