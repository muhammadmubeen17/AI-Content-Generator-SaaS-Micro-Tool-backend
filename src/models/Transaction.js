const mongoose = require('mongoose')

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    stripeSessionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    stripePaymentIntentId: {
      type: String,
      sparse: true,
    },
    stripeSubscriptionId: {
      type: String,
      sparse: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'usd',
      uppercase: true,
    },
    plan: {
      type: String,
      required: true,
      enum: ['free', 'pro', 'premium'],
    },
    previousPlan: {
      type: String,
      enum: ['free', 'pro', 'premium'],
    },
    creditsAdded: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    type: {
      type: String,
      enum: ['subscription', 'top_up', 'refund'],
      default: 'subscription',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
)

transactionSchema.index({ userId: 1, createdAt: -1 })
transactionSchema.index({ stripeSessionId: 1 })
transactionSchema.index({ status: 1 })

module.exports = mongoose.model('Transaction', transactionSchema)
