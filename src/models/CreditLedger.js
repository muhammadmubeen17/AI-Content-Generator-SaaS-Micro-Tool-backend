const mongoose = require('mongoose')

const creditLedgerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'plan_upgrade',
        'plan_downgrade',
        'monthly_reset',
        'top_up',
        'generation',
        'admin_add',
        'refund',
      ],
    },
    amount: {
      type: Number,
      required: true, // positive = credit added, negative = credit deducted
    },
    balanceAfter: {
      type: Number,
      required: true, // snapshot of user.credits after this entry
    },
    description: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // Can hold: { planFrom, planTo, contentId, transactionId, packId, etc. }
    },
  },
  { timestamps: true }
)

// Compound index for efficient per-user queries sorted by date
creditLedgerSchema.index({ userId: 1, createdAt: -1 })
creditLedgerSchema.index({ type: 1 })

module.exports = mongoose.model('CreditLedger', creditLedgerSchema)
