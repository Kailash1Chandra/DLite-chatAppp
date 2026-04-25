const { HttpError } = require("../utils/httpError");

function notFoundHandler(req, _res, next) {
  next(new HttpError(404, `Not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, _next) {
  const status = Number(err?.status || err?.statusCode || 500);
  const safeStatus = Number.isFinite(status) && status >= 400 && status <= 599 ? status : 500;
  const message = safeStatus === 500 ? "Internal server error" : String(err?.message || "Request failed");

  if (safeStatus === 500) {
    console.error(`[${req.requestId || "req"}]`, err);
  }

  res.status(safeStatus).json({
    ok: false,
    error: message,
    requestId: req.requestId || null,
  });
}

module.exports = { errorHandler, notFoundHandler };

