export const requestLogger = (req, _res, next) => {
  const timestamp = new Date().toISOString()

  // Keep logging simple so it is easy to understand while still being useful.
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`)

  next()
}
