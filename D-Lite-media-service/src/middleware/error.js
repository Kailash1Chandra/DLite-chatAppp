export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  })
}

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error)
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File is too large',
      status: 400,
      timestamp: new Date().toISOString(),
    })
  }

  const status = error.status || 500
  res.status(status).json({
    success: false,
    message: error.message || 'Internal server error',
    status,
    timestamp: new Date().toISOString(),
  })
}
