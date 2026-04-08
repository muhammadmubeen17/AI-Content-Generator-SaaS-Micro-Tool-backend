const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const { PLANS } = require('../config/constants')

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned in queries by default
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    plan: {
      type: String,
      enum: ['free', 'pro', 'premium'],
      default: 'free',
    },
    credits: {
      type: Number,
      default: PLANS.free.credits,
      min: 0,
    },
    totalCredits: {
      type: Number,
      default: PLANS.free.credits,
    },
    subscriptionId: {
      type: String,
      default: null,
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'inactive', 'cancelled', 'past_due'],
      default: 'inactive',
    },
    creditsResetAt: {
      type: Date,
      default: () => {
        const d = new Date()
        d.setMonth(d.getMonth() + 1)
        return d
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
    passwordChangedAt: {
      type: Date,
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// ---------- Indexes ----------
userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ createdAt: -1 })

// ---------- Virtuals ----------
userSchema.virtual('creditsUsed').get(function () {
  return this.totalCredits - this.credits
})

// ---------- Pre-save hooks ----------
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  if (!this.isNew) this.passwordChangedAt = Date.now()
  next()
})

// ---------- Instance methods ----------
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

userSchema.methods.hasEnoughCredits = function (cost) {
  return this.credits >= cost
}

userSchema.methods.deductCredits = async function (cost) {
  if (this.credits < cost) throw new Error('Insufficient credits')
  this.credits -= cost
  return this.save()
}

userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    plan: this.plan,
    credits: this.credits,
    totalCredits: this.totalCredits,
    creditsUsed: this.creditsUsed,
    subscriptionStatus: this.subscriptionStatus,
    createdAt: this.createdAt,
  }
}

module.exports = mongoose.model('User', userSchema)
