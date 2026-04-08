const { validationResult } = require('express-validator')

/**
 * Run express-validator checks and return first error if any
 */
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const first = errors.array()[0]
    return res.status(400).json({
      success: false,
      message: first.msg,
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    })
  }
  next()
}

module.exports = validate
