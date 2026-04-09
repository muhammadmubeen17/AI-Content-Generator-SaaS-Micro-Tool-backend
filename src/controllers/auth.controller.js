const crypto = require('crypto')
const User = require('../models/User')
const { sendTokenResponse } = require('../utils/jwt')
const { sendSuccess } = require('../utils/response')
const { createError, asyncHandler } = require('../utils/error')
const { PLANS } = require('../config/constants')
const { recordLedger } = require('../services/creditService')
const { sendVerificationEmail } = require('../services/emailService')

// ─── Helper: generate a secure verification token ─────────────────────────────
const createVerificationToken = () => {
  const rawToken = crypto.randomBytes(32).toString('hex')
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  return { rawToken, hashedToken, expires }
}

/**
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res, next) => {
  const { name, email, password } = req.body

  const existingUser = await User.findOne({ email })
  if (existingUser) {
    return next(createError(409, 'An account with this email already exists'))
  }

  // Calculate first reset date (30 days from now)
  const nextReset = new Date()
  nextReset.setDate(nextReset.getDate() + 30)

  // Generate email verification token
  const { rawToken, hashedToken, expires } = createVerificationToken()

  const user = await User.create({
    name,
    email,
    password,
    plan: 'free',
    credits: PLANS.free.credits,
    totalCredits: PLANS.free.credits,
    creditsResetAt: nextReset,
    isEmailVerified: false,
    emailVerificationToken: hashedToken,
    emailVerificationExpires: expires,
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

  // Send verification email (non-blocking — don't fail registration if email fails)
  sendVerificationEmail({ name: user.name, email: user.email, token: rawToken }).catch(
    (err) => console.error('Failed to send verification email:', err.message)
  )

  sendTokenResponse(user, 201, res, 'Account created! Please check your email to verify your account.')
})

/**
 * GET /api/auth/verify-email/:token
 */
const verifyEmail = asyncHandler(async (req, res, next) => {
  const { token } = req.params
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() },
  }).select('+emailVerificationToken +emailVerificationExpires')

  if (!user) {
    return next(createError(400, 'Verification link is invalid or has expired. Please request a new one.'))
  }

  user.isEmailVerified = true
  user.emailVerificationToken = undefined
  user.emailVerificationExpires = undefined
  await user.save({ validateBeforeSave: false })

  sendTokenResponse(user, 200, res, 'Email verified successfully! Welcome to ContentAI.')
})

/**
 * POST /api/auth/resend-verification
 */
const resendVerification = asyncHandler(async (req, res, next) => {
  if (req.user.isEmailVerified) {
    return next(createError(400, 'Your email address is already verified.'))
  }

  const { rawToken, hashedToken, expires } = createVerificationToken()

  await User.findByIdAndUpdate(req.user._id, {
    emailVerificationToken: hashedToken,
    emailVerificationExpires: expires,
  })

  await sendVerificationEmail({ name: req.user.name, email: req.user.email, token: rawToken })

  sendSuccess(res, {}, 'Verification email sent. Please check your inbox.')
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

module.exports = { register, login, getMe, logout, changePassword, verifyEmail, resendVerification }
