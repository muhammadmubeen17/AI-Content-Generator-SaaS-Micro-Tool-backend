const PLANS = {
  free: {
    name: 'Free',
    credits: parseInt(process.env.FREE_CREDITS) || 20,
    price: 0,
  },
  pro: {
    name: 'Pro',
    credits: parseInt(process.env.PRO_CREDITS) || 200,
    price: 29,
  },
}

const CREDIT_COSTS = {
  short: parseInt(process.env.COST_SHORT) || 1,
  medium: parseInt(process.env.COST_MEDIUM) || 2,
  long: parseInt(process.env.COST_LONG) || 4,
}

const CONTENT_TYPES = ['blog', 'ad_copy', 'proposal', 'email', 'social', 'product', 'youtube', 'upwork', 'fiverr_gig', 'linkedin']
const TONES = ['professional', 'casual', 'persuasive', 'informative', 'humorous', 'formal']
const LENGTHS = ['short', 'medium', 'long']
const ROLES = ['user', 'admin']

const CREDIT_PACKS = {
  small: {
    id: 'small',
    name: '50 Credits',
    credits: 50,
    price: 5,
    stripePriceId: process.env.STRIPE_PRICE_CREDITS_SMALL,
  },
  medium: {
    id: 'medium',
    name: '150 Credits',
    credits: 150,
    price: 12,
    stripePriceId: process.env.STRIPE_PRICE_CREDITS_MEDIUM,
  },
  large: {
    id: 'large',
    name: '500 Credits',
    credits: 500,
    price: 35,
    stripePriceId: process.env.STRIPE_PRICE_CREDITS_LARGE,
  },
}

// Approximate token counts for billing/tracking
const LENGTH_TOKENS = {
  short: 200,
  medium: 500,
  long: 1000,
}

module.exports = { PLANS, CREDIT_COSTS, CREDIT_PACKS, CONTENT_TYPES, TONES, LENGTHS, ROLES, LENGTH_TOKENS }
