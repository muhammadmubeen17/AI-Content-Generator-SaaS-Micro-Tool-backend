const rateLimit = require('express-rate-limit')

const createLimiter = (options) =>
  rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: options.message || 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000 / 60) + ' minutes',
      })
    },
    ...options,
  })

// General API limit
const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: 'Too many requests from this IP. Try again in 15 minutes.',
})

// Auth endpoints — stricter
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: 'Too many login attempts. Try again in 15 minutes.',
})

// AI generation — prevent abuse
const generateLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 min
  max: 5,
  message: 'Generation rate limit exceeded. Max 5 requests per minute.',
})

module.exports = { generalLimiter, authLimiter, generateLimiter }
