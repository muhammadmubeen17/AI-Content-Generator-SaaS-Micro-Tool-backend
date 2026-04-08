const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { createError } = require('../utils/error')

/**
 * Verify JWT and attach user to req.user
 */
const protect = async (req, res, next) => {
  try {
    // 1. Extract token from Authorization header or cookie
    let token
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1]
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt
    }

    if (!token) {
      return next(createError(401, 'Authentication required. Please log in.'))
    }

    // 2. Verify token
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(createError(401, 'Session expired. Please log in again.'))
      }
      return next(createError(401, 'Invalid token. Please log in again.'))
    }

    // 3. Check user still exists and is active
    const user = await User.findById(decoded.id).select('+passwordChangedAt')
    if (!user) {
      return next(createError(401, 'The user belonging to this token no longer exists.'))
    }

    if (!user.isActive) {
      return next(createError(401, 'Your account has been deactivated. Contact support.'))
    }

    // 4. Check if password was changed after token was issued
    if (user.passwordChangedAt) {
      const changedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10)
      if (decoded.iat < changedTimestamp) {
        return next(createError(401, 'Password recently changed. Please log in again.'))
      }
    }

    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * Restrict to specific roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(
        createError(403, `Access denied. Requires role: ${roles.join(' or ')}`)
      )
    }
    next()
  }
}

/**
 * Check user has sufficient credits (attaches cost to req)
 */
const requireCredits = (getCost) => {
  return async (req, res, next) => {
    try {
      const cost = typeof getCost === 'function' ? getCost(req) : getCost
      if (!req.user.hasEnoughCredits(cost)) {
        return next(
          createError(402, `Insufficient credits. You need ${cost} credit(s) but only have ${req.user.credits}.`)
        )
      }
      req.creditCost = cost
      next()
    } catch (err) {
      next(err)
    }
  }
}

module.exports = { protect, authorize, requireCredits }
