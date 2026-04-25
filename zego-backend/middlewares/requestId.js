function requestIdMiddleware(req, res, next) {
  const existing = req.headers["x-request-id"];
  const id =
    (typeof existing === "string" && existing.trim()) ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}

module.exports = { requestIdMiddleware };

