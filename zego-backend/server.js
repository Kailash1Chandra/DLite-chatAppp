require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { apiRateLimiter } = require("./middlewares/rateLimit");
const { requestIdMiddleware } = require("./middlewares/requestId");
const { errorHandler, notFoundHandler } = require("./middlewares/errorHandler");
const apiRoutes = require("./routes");

const PORT = Number(process.env.PORT || 5000);

const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(requestIdMiddleware);
app.use(morgan(":method :url :status :res[content-length] - :response-time ms :req[x-request-id]"));
app.use(apiRateLimiter);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "dlite-zego-backend" });
});

app.use("/api", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  // Intentionally minimal log for prod friendliness.
  console.log(`dlite-zego-backend listening on :${PORT}`);
});

