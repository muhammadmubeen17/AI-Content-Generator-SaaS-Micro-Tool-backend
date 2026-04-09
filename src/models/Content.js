const mongoose = require('mongoose')

const contentSchema = new mongoose.Schema(
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
      enum: ['blog', 'ad_copy', 'proposal', 'email', 'social', 'product', 'youtube', 'upwork', 'fiverr_gig', 'linkedin'],
    },
    tone: {
      type: String,
      required: true,
      enum: ['professional', 'casual', 'persuasive', 'informative', 'humorous', 'formal'],
    },
    length: {
      type: String,
      required: true,
      enum: ['short', 'medium', 'long'],
    },
    prompt: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, 'Prompt cannot exceed 2000 characters'],
    },
    output: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    tokensUsed: {
      type: Number,
      default: 0,
    },
    creditsDeducted: {
      type: Number,
      required: true,
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template',
      default: null,
    },
    isFavorited: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
)

// ---------- Indexes ----------
contentSchema.index({ userId: 1, createdAt: -1 })
contentSchema.index({ userId: 1, type: 1 })
contentSchema.index({ createdAt: -1 })

// ---------- Pre-save ----------
contentSchema.pre('save', function (next) {
  if (this.isModified('output') && this.output) {
    this.wordCount = this.output.split(/\s+/).filter(Boolean).length
    // Auto-generate title from prompt if not provided
    if (!this.title && this.prompt) {
      this.title = this.prompt.slice(0, 80) + (this.prompt.length > 80 ? '...' : '')
    }
  }
  next()
})

// ---------- Statics ----------
contentSchema.statics.getUserStats = async function (userId) {
  const stats = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalWords: { $sum: '$wordCount' },
        totalCredits: { $sum: '$creditsDeducted' },
      },
    },
  ])
  return stats
}

module.exports = mongoose.model('Content', contentSchema)
