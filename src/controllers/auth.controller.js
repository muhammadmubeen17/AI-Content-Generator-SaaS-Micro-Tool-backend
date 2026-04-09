const User = require('../models/User')
const { sendTokenResponse } = require('../utils/jwt')
const { sendSuccess } = require('../utils/response')
const { createError, asyncHandler } = require('../utils/error')
const { PLANS } = require('../config/constants')
const { recordLedger } = require('../services/creditService')

/**
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res, next) => {
  const { name, email, password } = req.body

  const existingUser = await User.findOne({ email })
  if (existingUser) {
    return next(createError(409, 'An account with this email already exists'))
  }

  // Calculate first reset date (1st of next month)
  const nextReset = new Date()
  nextReset.setMonth(nextReset.getMonth() + 1)
  nextReset.setDate(1)
  nextReset.setHours(0, 0, 0, 0)

  const user = await User.create({
    name,
    email,
    password,
    plan: 'free',
    credits: PLANS.free.credits,
    totalCredits: PLANS.free.credits,
    creditsResetAt: nextReset,
  })

  // Record initial free credits in the ledger
  await recordLedger({
    userId: user._id,
    type: 'monthly_reset',
    amount: PLANS.free.credits,
    balanceAfter: PLANS.free.credits,
    description: `Welcome! Free plan activated (+${PLANS.free.credits} credits)`,
    metadata: { planId: 'free', event: 'registration' },
  })

  sendTokenResponse(user, 201, res, 'Account created successfully')
})

/**
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body

  // Explicitly select password (excluded by default)
  const user = await User.findOne({ email }).select('+password')

  if (!user || !(await user.comparePassword(password))) {
    return next(createError(401, 'Invalid email or password'))
  }

  if (!user.isActive) {
    return next(createError(401, 'Account is deactivated. Contact support.'))
  }

  // Update last login
  user.lastLoginAt = new Date()
  await user.save({ validateBeforeSave: false })

  sendTokenResponse(user, 200, res, 'Logged in successfully')
})

/**
 * GET /api/auth/me
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  sendSuccess(res, { user: user.toPublicJSON() }, 'User retrieved')
})

/**
 * POST /api/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
  })
  sendSuccess(res, {}, 'Logged out successfully')
})

/**
 * PATCH /api/auth/change-password
 */
const changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body

  const user = await User.findById(req.user._id).select('+password')

  if (!(await user.comparePassword(currentPassword))) {
    return next(createError(401, 'Current password is incorrect'))
  }

  user.password = newPassword
  await user.save()

  sendTokenResponse(user, 200, res, 'Password changed successfully')
})

module.exports = { register, login, getMe, logout, changePassword }
