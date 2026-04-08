const User = require('../models/User')
const Content = require('../models/Content')
const { addCredits } = require('../services/creditService')
const { sendSuccess } = require('../utils/response')
const { createError, asyncHandler } = require('../utils/error')

/**
 * GET /api/user/profile
 */
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  sendSuccess(res, { user: user.toPublicJSON() }, 'Profile retrieved')
})

/**
 * PATCH /api/user/profile
 */
const updateProfile = asyncHandler(async (req, res, next) => {
  const { name, email } = req.body

  // Check email uniqueness if being changed
  if (email && email !== req.user.email) {
    const exists = await User.findOne({ email, _id: { $ne: req.user._id } })
    if (exists) return next(createError(409, 'Email is already in use'))
  }

  const updates = {}
  if (name) updates.name = name.trim()
  if (email) updates.email = email.toLowerCase().trim()

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  })

  sendSuccess(res, { user: user.toPublicJSON() }, 'Profile updated successfully')
})

/**
 * GET /api/user/credits
 */
const getCredits = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  sendSuccess(res, {
    credits: user.credits,
    totalCredits: user.totalCredits,
    creditsUsed: user.totalCredits - user.credits,
    plan: user.plan,
    creditsResetAt: user.creditsResetAt,
  }, 'Credits retrieved')
})

/**
 * POST /api/user/add-credits  (admin only)
 */
const adminAddCredits = asyncHandler(async (req, res, next) => {
  const { userId, amount } = req.body

  if (!userId) return next(createError(400, 'userId is required'))
  if (!amount || amount < 1) return next(createError(400, 'Amount must be a positive number'))

  const user = await addCredits(userId, amount)

  sendSuccess(res, {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      credits: user.credits,
    },
  }, `${amount} credits added successfully`)
})

/**
 * GET /api/user/dashboard-stats
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user._id
  const user = await User.findById(userId)

  const [typeStats, recentContent, weeklyCount] = await Promise.all([
    Content.getUserStats(userId),
    Content.find({ userId })
      .select('type title prompt wordCount createdAt creditsDeducted')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Content.countDocuments({
      userId,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
  ])

  const totalGenerated = typeStats.reduce((sum, s) => sum + s.count, 0)
  const totalWords = typeStats.reduce((sum, s) => sum + s.totalWords, 0)

  sendSuccess(res, {
    stats: {
      totalGenerated,
      totalWords,
      weeklyCount,
      creditsRemaining: user.credits,
      creditsUsed: user.totalCredits - user.credits,
      plan: user.plan,
    },
    byType: typeStats,
    recentContent,
  }, 'Dashboard stats retrieved')
})

/**
 * GET /api/user/all  (admin only) — list all users
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const limit = parseInt(req.query.limit) || 20
  const skip = (page - 1) * limit

  const [users, total] = await Promise.all([
    User.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(),
  ])

  sendSuccess(res, { users, total, page }, 'Users retrieved')
})

module.exports = { getProfile, updateProfile, getCredits, adminAddCredits, getDashboardStats, getAllUsers }
