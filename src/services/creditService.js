const { CREDIT_COSTS, PLANS } = require('../config/constants')
const User = require('../models/User')

/**
 * Calculate credit cost for a generation request
 */
const calculateCost = (length) => {
  return CREDIT_COSTS[length] || CREDIT_COSTS.medium
}

/**
 * Deduct credits from a user atomically
 * Uses findOneAndUpdate to prevent race conditions
 */
const deductCredits = async (userId, cost) => {
  const user = await User.findOneAndUpdate(
    { _id: userId, credits: { $gte: cost } },
    { $inc: { credits: -cost } },
    { new: true }
  )

  if (!user) {
    // Either user not found or insufficient credits
    const existing = await User.findById(userId)
    if (!existing) throw new Error('User not found')
    throw new Error(`Insufficient credits. Required: ${cost}, Available: ${existing.credits}`)
  }

  return user
}

/**
 * Add credits to a user (admin top-up or subscription upgrade)
 */
const addCredits = async (userId, amount) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { credits: amount } },
    { new: true }
  )
  if (!user) throw new Error('User not found')
  return user
}

/**
 * Apply a new plan to the user — set credits to plan's allocation
 */
const applyPlan = async (userId, planId, subscriptionId = null) => {
  const plan = PLANS[planId]
  if (!plan) throw new Error(`Unknown plan: ${planId}`)

  const updateData = {
    plan: planId,
    credits: plan.credits,
    totalCredits: plan.credits,
    subscriptionStatus: 'active',
    creditsResetAt: getNextResetDate(),
  }

  if (subscriptionId) {
    updateData.subscriptionId = subscriptionId
  }

  const user = await User.findByIdAndUpdate(userId, updateData, { new: true })
  if (!user) throw new Error('User not found')
  return user
}

/**
 * Reset monthly credits for a user (called via webhook or cron)
 */
const resetMonthlyCredits = async (userId) => {
  const user = await User.findById(userId)
  if (!user) throw new Error('User not found')

  const plan = PLANS[user.plan] || PLANS.free
  user.credits = plan.credits
  user.totalCredits = plan.credits
  user.creditsResetAt = getNextResetDate()

  return user.save()
}

const getNextResetDate = () => {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

module.exports = { calculateCost, deductCredits, addCredits, applyPlan, resetMonthlyCredits }
