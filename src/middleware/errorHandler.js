/**
 * Central error handling middleware — must be last in the stack
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500
  let message = err.message || 'Internal server error'

  // Mongoose: document not found
  if (err.name === 'CastError') {
    message = `Resource not found with id: ${err.value}`
    statusCode = 404
  }

  // Mongoose: duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field'
    const value = err.keyValue?.[field]
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' is already taken`
    statusCode = 409
  }

  // Mongoose: validation error
  if (err.name === 'ValidationError') {
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('. ')
    statusCode = 400
  }

  // JSON parse error
  if (err.type === 'entity.parse.failed') {
    message = 'Invalid JSON in request body'
    statusCode = 400
  }

  const response = {
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      error: err,
    }),
  }

  if (process.env.NODE_ENV === 'development') {
    console.error(`[ERROR] ${statusCode} - ${message}`)
    if (err.stack) console.error(err.stack)
  }

  res.status(statusCode).json(response)
}

/**
 * 404 handler for unmatched routes
 */
const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`)
  error.statusCode = 404
  next(error)
}

module.exports = { errorHandler, notFound }
