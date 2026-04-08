const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { PLANS } = require('../config/constants')

// Map plan ID to Stripe price ID
const PRICE_MAP = {
  pro: process.env.STRIPE_PRICE_ID_PRO,
  premium: process.env.STRIPE_PRICE_ID_PREMIUM,
}

/**
 * Create or retrieve a Stripe customer for a user
 */
const getOrCreateCustomer = async (user) => {
  if (user.stripeCustomerId) {
    return stripe.customers.retrieve(user.stripeCustomerId)
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user._id.toString() },
  })

  user.stripeCustomerId = customer.id
  await user.save()

  return customer
}

/**
 * Create a Stripe Checkout session for subscription
 */
const createCheckoutSession = async ({ user, planId, successUrl, cancelUrl }) => {
  if (!PRICE_MAP[planId]) {
    throw new Error(`No Stripe price configured for plan: ${planId}`)
  }

  const customer = await getOrCreateCustomer(user)

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [
      {
        price: PRICE_MAP[planId],
        quantity: 1,
      },
    ],
    success_url: successUrl || `${process.env.FRONTEND_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/billing?cancelled=true`,
    metadata: {
      userId: user._id.toString(),
      planId,
    },
    subscription_data: {
      metadata: {
        userId: user._id.toString(),
        planId,
      },
    },
    allow_promotion_codes: true,
  })

  return session
}

/**
 * Handle a Stripe webhook event
 */
const constructWebhookEvent = (rawBody, signature) => {
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  )
}

/**
 * Retrieve a checkout session by ID
 */
const retrieveSession = (sessionId) => {
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'customer'],
  })
}

/**
 * Cancel a subscription
 */
const cancelSubscription = (subscriptionId) => {
  return stripe.subscriptions.cancel(subscriptionId)
}

module.exports = {
  stripe,
  getOrCreateCustomer,
  createCheckoutSession,
  constructWebhookEvent,
  retrieveSession,
  cancelSubscription,
}
