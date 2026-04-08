/**
 * Create a typed HTTP error
 */
const createError = (statusCode, message) => {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

/**
 * Wrap async route handlers to avoid try/catch boilerplate
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

module.exports = { createError, asyncHandler }
