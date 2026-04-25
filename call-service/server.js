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
const { io, emitToUser } = initSocketServer(server);
app.set("io", io);
app.set("emitToUser", emitToUser);

server.listen(PORT, () => {
  console.log(`call-service listening on :${PORT}`);
});

