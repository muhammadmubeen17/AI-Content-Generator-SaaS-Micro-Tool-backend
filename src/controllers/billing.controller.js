const Transaction = require('../models/Transaction')
const CreditLedger = require('../models/CreditLedger')
const User = require('../models/User')
const { createCheckoutSession, createCreditPackCheckout, constructWebhookEvent, cancelSubscription } = require('../services/stripeService')
const { applyPlan, purchaseTopUp } = require('../services/creditService')
const { sendSuccess } = require('../utils/response')
const { createError, asyncHandler } = require('../utils/error')
const { PLANS, CREDIT_PACKS } = require('../config/constants')

/**
 * POST /api/billing/create-checkout-session
 */
const createSession = asyncHandler(async (req, res, next) => {
  const { planId } = req.body

  if (!planId || !PLANS[planId]) {
    return next(createError(400, `Invalid plan. Must be one of: ${Object.keys(PLANS).join(', ')}`))
  }

  if (planId === 'free') {
    return next(createError(400, 'Cannot checkout for the free plan. Use the downgrade endpoint.'))
  }

  if (req.user.plan === planId) {
    return next(createError(409, `You are already on the ${planId} plan`))
  }

  // Create a pending transaction record
  const transaction = await Transaction.create({
    userId: req.user._id,
    amount: PLANS[planId].price,
    plan: planId,
    previousPlan: req.user.plan,
    creditsAdded: PLANS[planId].credits,
    status: 'pending',
    type: 'subscription',
  })

  let session
  try {
    session = await createCheckoutSession({
      user: req.user,
      planId,
      successUrl: `${process.env.FRONTEND_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.FRONTEND_URL}/billing?cancelled=true`,
    })

    // Link transaction to session
    transaction.stripeSessionId = session.id
    await transaction.save()
  } catch (err) {
    // Cleanup pending transaction if Stripe fails
    await transaction.deleteOne()

    // Provide useful error in dev (Stripe not configured)
    if (err.message.includes('No Stripe price configured') || err.message.includes('Invalid API Key')) {
      // Simulate success in dev/mock mode
      const updatedUser = await applyPlan(req.user._id, planId)

      // Record a completed mock transaction
      await Transaction.create({
        userId: req.user._id,
        amount: PLANS[planId].price,
        plan: planId,
        previousPlan: req.user.plan,
        creditsAdded: PLANS[planId].credits,
        status: 'completed',
        type: 'subscription',
        metadata: { mock: true },
      })

      return sendSuccess(res, {
        mock: true,
        message: `[DEV MODE] Plan upgraded to ${planId}. Credits accumulated properly.`,
        url: `${process.env.FRONTEND_URL}/billing?success=true`,
        user: updatedUser.toPublicJSON(),
      }, 'Mock checkout complete')
    }

    return next(createError(500, `Payment session error: ${err.message}`))
  }

  sendSuccess(res, { url: session.url, sessionId: session.id }, 'Checkout session created')
})

/**
 * POST /api/billing/downgrade
 * Downgrade from a paid plan to free
 */
const downgrade = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id)
  if (!user) return next(createError(404, 'User not found'))

  if (user.plan === 'free') {
    return next(createError(400, 'You are already on the free plan'))
  }

  const previousPlan = user.plan
  const previousCredits = user.credits

  // Cancel Stripe subscription if exists
  if (user.subscriptionId) {
    try {
      await cancelSubscription(user.subscriptionId)
    } catch (err) {
      console.log(`[Downgrade] Stripe cancel skipped: ${err.message}`)
    }
  }

  // Apply free plan (credits will be capped)
  const updatedUser = await applyPlan(user._id, 'free')

  // Record downgrade transaction
  await Transaction.create({
    userId: user._id,
    amount: 0,
    plan: 'free',
    previousPlan,
    creditsAdded: 0,
    status: 'completed',
    type: 'subscription',
    metadata: {
      action: 'downgrade',
      previousCredits,
      newCredits: updatedUser.credits,
    },
  })

  sendSuccess(res, {
    user: updatedUser.toPublicJSON(),
    message: `Downgraded from ${previousPlan} to free. Credits capped at ${updatedUser.credits}.`,
  }, 'Plan downgraded')
})

/**
 * POST /api/billing/purchase-credits
 * Buy a credit top-up pack via Stripe checkout (or mock in dev)
 */
const purchaseCredits = asyncHandler(async (req, res, next) => {
  const { packId } = req.body

  if (!packId || !CREDIT_PACKS[packId]) {
    return next(createError(400, `Invalid pack. Must be one of: ${Object.keys(CREDIT_PACKS).join(', ')}`))
  }

  const pack = CREDIT_PACKS[packId]

  // Create a pending transaction
  const transaction = await Transaction.create({
    userId: req.user._id,
    amount: pack.price,
    plan: req.user.plan,
    creditsAdded: pack.credits,
    status: 'pending',
    type: 'top_up',
    metadata: { packId, packName: pack.name },
  })

  let session
  try {
    session = await createCreditPackCheckout({
      user: req.user,
      packId,
      successUrl: `${process.env.FRONTEND_URL}/billing?credits_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.FRONTEND_URL}/billing?cancelled=true`,
    })

    transaction.stripeSessionId = session.id
    await transaction.save()
  } catch (err) {
    await transaction.deleteOne()

    // Dev mock mode — Stripe not configured
    if (err.message.includes('No Stripe price configured') || err.message.includes('Invalid API Key')) {
      const updatedUser = await purchaseTopUp(req.user._id, packId)

      await Transaction.create({
        userId: req.user._id,
        amount: pack.price,
        plan: req.user.plan,
        creditsAdded: pack.credits,
        status: 'completed',
        type: 'top_up',
        metadata: { packId, packName: pack.name, mock: true },
      })

      return sendSuccess(res, {
        mock: true,
        user: updatedUser.toPublicJSON(),
        creditsAdded: pack.credits,
        message: `[DEV MODE] ${pack.name} purchased! +${pack.credits} credits added.`,
      }, 'Mock credit purchase complete')
    }

    return next(createError(500, `Payment session error: ${err.message}`))
  }

  sendSuccess(res, { url: session.url, sessionId: session.id }, 'Checkout session created')
})

/**
 * GET /api/billing/credit-history
 * Paginated credit ledger entries
 */
const getCreditHistory = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const limit = parseInt(req.query.limit) || 15
  const skip = (page - 1) * limit

  const [entries, total] = await Promise.all([
    CreditLedger.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CreditLedger.countDocuments({ userId: req.user._id }),
  ])

  sendSuccess(res, {
    entries,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }, 'Credit history retrieved')
})

/**
 * POST /api/billing/webhook
 * Raw body required — must be registered BEFORE express.json()
 */
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = constructWebhookEvent(req.body, sig)
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        await handleCheckoutCompleted(session)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        await handleInvoicePaymentSucceeded(invoice)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        await handlePaymentFailed(invoice)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        await handleSubscriptionCancelled(subscription)
        break
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event.type}`)
    }
  } catch (err) {
    console.error('[Webhook] Processing error:', err)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }

  res.json({ received: true })
}

// ─── Webhook handlers ─────────────────────────────────────────────────────────

const handleCheckoutCompleted = async (session) => {
  const metadata = session.metadata || {}
  const { userId } = metadata
  if (!userId) return

  // ── Credit pack one-time purchase ──
  if (metadata.type === 'credit_pack') {
    const { packId } = metadata
    if (!packId) return

    await purchaseTopUp(userId, packId)

    await Transaction.findOneAndUpdate(
      { stripeSessionId: session.id },
      {
        status: 'completed',
        stripePaymentIntentId: session.payment_intent,
      }
    )

    console.log(`✅ Credit pack purchased: user=${userId} pack=${packId}`)
    return
  }

  // ── Subscription upgrade ──
  const { planId } = metadata
  if (!planId) return

  await applyPlan(userId, planId, session.subscription)

  await Transaction.findOneAndUpdate(
    { stripeSessionId: session.id },
    {
      status: 'completed',
      stripePaymentIntentId: session.payment_intent,
      stripeSubscriptionId: session.subscription,
      creditsAdded: PLANS[planId]?.credits || 0,
    }
  )

  console.log(`✅ Plan upgraded: user=${userId} plan=${planId}`)
}

const handleInvoicePaymentSucceeded = async (invoice) => {
  const subscriptionId = invoice.subscription
  if (!subscriptionId) return

  const user = await User.findOne({ subscriptionId })
  if (!user) return

  // Renew credits on successful renewal
  const { resetMonthlyCredits } = require('../services/creditService')
  await resetMonthlyCredits(user._id)

  console.log(`🔄 Credits renewed for user: ${user.email}`)
}

const handlePaymentFailed = async (invoice) => {
  const subscriptionId = invoice.subscription
  if (!subscriptionId) return

  await User.findOneAndUpdate(
    { subscriptionId },
    { subscriptionStatus: 'past_due' }
  )

  console.log(`⚠️  Payment failed for subscription: ${subscriptionId}`)
}

const handleSubscriptionCancelled = async (subscription) => {
  const user = await User.findOne({ subscriptionId: subscription.id })
  if (!user) return

  // Use applyPlan to properly downgrade with ledger
  await applyPlan(user._id, 'free')

  console.log(`❌ Subscription cancelled: ${subscription.id}`)
}

/**
 * GET /api/billing/transactions
 */
const getTransactions = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean()

  sendSuccess(res, { transactions }, 'Transactions retrieved')
})

module.exports = {
  createSession,
  downgrade,
  purchaseCredits,
  getCreditHistory,
  handleWebhook,
  getTransactions,
}
