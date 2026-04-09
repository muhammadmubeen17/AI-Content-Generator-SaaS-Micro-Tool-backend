const { CREDIT_COSTS, PLANS, CREDIT_PACKS } = require('../config/constants')
const User = require('../models/User')
const CreditLedger = require('../models/CreditLedger')

/**
 * Calculate credit cost for a generation request
 */
const calculateCost = (length) => {
  return CREDIT_COSTS[length] || CREDIT_COSTS.medium
}

// ─── Ledger helper ──────────────────────────────────────────────────────────────

/**
 * Record a credit ledger entry (audit trail)
 */
const recordLedger = async ({ userId, type, amount, balanceAfter, description, metadata = {} }) => {
  return CreditLedger.create({ userId, type, amount, balanceAfter, description, metadata })
}

// ─── Credit mutations ───────────────────────────────────────────────────────────

/**
 * Deduct credits from a user atomically.
 * Uses findOneAndUpdate to prevent race conditions.
 */
const deductCredits = async (userId, cost, meta = {}) => {
  const user = await User.findOneAndUpdate(
    { _id: userId, credits: { $gte: cost } },
    { $inc: { credits: -cost } },
    { new: true }
  )

  if (!user) {
    const existing = await User.findById(userId)
    if (!existing) throw new Error('User not found')
    throw new Error(`Insufficient credits. Required: ${cost}, Available: ${existing.credits}`)
  }

  // Record ledger
  await recordLedger({
    userId,
    type: 'generation',
    amount: -cost,
    balanceAfter: user.credits,
    description: `Content generation (${meta.length || 'medium'} length)`,
    metadata: { contentId: meta.contentId, cost },
  })

  return user
}

/**
 * Add credits to a user (admin top-up)
 */
const addCredits = async (userId, amount) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { credits: amount, totalCredits: amount } },
    { new: true }
  )
  if (!user) throw new Error('User not found')

  await recordLedger({
    userId,
    type: 'admin_add',
    amount,
    balanceAfter: user.credits,
    description: `Admin added ${amount} credits`,
    metadata: { adminAdd: true },
  })

  return user
}

/**
 * Apply a new plan to the user.
 * - UPGRADE: accumulates credits (existing + plan bonus)
 * - DOWNGRADE: caps credits at new plan's allocation
 */
const applyPlan = async (userId, planId, subscriptionId = null) => {
  const plan = PLANS[planId]
  if (!plan) throw new Error(`Unknown plan: ${planId}`)

  const currentUser = await User.findById(userId)
  if (!currentUser) throw new Error('User not found')

  const previousPlan = currentUser.plan
  const previousCredits = currentUser.credits
  const isUpgrade = getPlanRank(planId) > getPlanRank(previousPlan)
  const isDowngrade = getPlanRank(planId) < getPlanRank(previousPlan)

  let newCredits
  let newTotalCredits

  if (isUpgrade) {
    // UPGRADE: add plan credits to existing balance
    newCredits = previousCredits + plan.credits
    newTotalCredits = plan.credits
  } else if (isDowngrade) {
    // DOWNGRADE: cap credits at new plan's max
    newCredits = Math.min(previousCredits, plan.credits)
    newTotalCredits = plan.credits
  } else {
    // Same plan renewal
    newCredits = plan.credits
    newTotalCredits = plan.credits
  }

  const updateData = {
    plan: planId,
    credits: newCredits,
    totalCredits: newTotalCredits,
    subscriptionStatus: planId === 'free' ? 'inactive' : 'active',
    creditsResetAt: getNextResetDate(),
  }

  if (subscriptionId) {
    updateData.subscriptionId = subscriptionId
  }

  // Clear subscription on downgrade to free
  if (planId === 'free') {
    updateData.subscriptionId = null
  }

  const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true })

  // Record ledger
  const creditDelta = newCredits - previousCredits
  await recordLedger({
    userId,
    type: isUpgrade ? 'plan_upgrade' : isDowngrade ? 'plan_downgrade' : 'monthly_reset',
    amount: creditDelta,
    balanceAfter: newCredits,
    description: isUpgrade
      ? `Upgraded from ${previousPlan} to ${planId} (+${plan.credits} credits)`
      : isDowngrade
        ? `Downgraded from ${previousPlan} to ${planId} (capped at ${plan.credits})`
        : `Plan renewed (${planId})`,
    metadata: { planFrom: previousPlan, planTo: planId, previousCredits },
  })

  return updatedUser
}

/**
 * Purchase a credit top-up pack — adds credits to current balance
 */
const purchaseTopUp = async (userId, packId) => {
  const pack = CREDIT_PACKS[packId]
  if (!pack) throw new Error(`Unknown credit pack: ${packId}`)

  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { credits: pack.credits, totalCredits: pack.credits } },
    { new: true }
  )
  if (!user) throw new Error('User not found')

  await recordLedger({
    userId,
    type: 'top_up',
    amount: pack.credits,
    balanceAfter: user.credits,
    description: `Purchased ${pack.name} (+${pack.credits} credits)`,
    metadata: { packId, packName: pack.name, price: pack.price },
  })

  return user
}

/**
 * Reset monthly credits for a user (called via webhook or cron)
 */
const resetMonthlyCredits = async (userId) => {
  const user = await User.findById(userId)
  if (!user) throw new Error('User not found')

  const plan = PLANS[user.plan] || PLANS.free
  const previousCredits = user.credits

  user.credits = plan.credits
  user.totalCredits = plan.credits
  user.creditsResetAt = getNextResetDate()
  await user.save()

  await recordLedger({
    userId,
    type: 'monthly_reset',
    amount: plan.credits - previousCredits,
    balanceAfter: plan.credits,
    description: `Monthly credits reset for ${user.plan} plan`,
    metadata: { planId: user.plan, previousCredits },
  })

  return user
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const getPlanRank = (planId) => {
  const ranks = { free: 0, pro: 1, premium: 2 }
  return ranks[planId] ?? 0
}

const getNextResetDate = () => {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

module.exports = {
  calculateCost,
  deductCredits,
  addCredits,
  applyPlan,
  purchaseTopUp,
  resetMonthlyCredits,
  recordLedger,
}
