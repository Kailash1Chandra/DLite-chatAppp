export const notFoundHandler = (req, res, _next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  })
}

export const errorHandler = (err, _req, res, _next) => {
  console.error('auth-service error:', err.message)

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  })
}
