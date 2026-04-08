const Transaction = require('../models/Transaction')
const User = require('../models/User')
const { createCheckoutSession, constructWebhookEvent } = require('../services/stripeService')
const { applyPlan } = require('../services/creditService')
const { sendSuccess } = require('../utils/response')
const { createError, asyncHandler } = require('../utils/error')
const { PLANS } = require('../config/constants')

/**
 * POST /api/billing/create-checkout-session
 */
const createSession = asyncHandler(async (req, res, next) => {
  const { planId } = req.body

  if (!planId || !PLANS[planId]) {
    return next(createError(400, `Invalid plan. Must be one of: ${Object.keys(PLANS).join(', ')}`))
  }

  if (planId === 'free') {
    return next(createError(400, 'Cannot checkout for the free plan'))
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
    status: 'pending',
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
      await applyPlan(req.user._id, planId)
      return sendSuccess(res, {
        mock: true,
        message: `[DEV MODE] Plan upgraded to ${planId} without Stripe. Configure STRIPE_SECRET_KEY to enable real payments.`,
        url: `${process.env.FRONTEND_URL}/billing?success=true`,
      }, 'Mock checkout complete')
    }

    return next(createError(500, `Payment session error: ${err.message}`))
  }

  sendSuccess(res, { url: session.url, sessionId: session.id }, 'Checkout session created')
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
  const { userId, planId } = session.metadata || {}
  if (!userId || !planId) return

  // Upgrade user plan and credits
  await applyPlan(userId, planId, session.subscription)

  // Mark transaction as completed
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
  const plan = PLANS[user.plan] || PLANS.free
  user.credits = plan.credits
  user.totalCredits = plan.credits
  user.subscriptionStatus = 'active'
  await user.save()

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
  await User.findOneAndUpdate(
    { subscriptionId: subscription.id },
    {
      plan: 'free',
      subscriptionStatus: 'cancelled',
      subscriptionId: null,
      credits: PLANS.free.credits,
      totalCredits: PLANS.free.credits,
    }
  )

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

module.exports = { createSession, handleWebhook, getTransactions }
