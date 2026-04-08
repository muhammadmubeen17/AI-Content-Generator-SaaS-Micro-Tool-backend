const mongoose = require('mongoose')

const fieldSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'textarea', 'select', 'number'],
      default: 'text',
    },
    placeholder: String,
    options: [String], // for select fields
    required: { type: Boolean, default: false },
    maxLength: Number,
  },
  { _id: false }
)

const templateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Template title is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['Content', 'E-commerce', 'Communication', 'Social', 'Marketing', 'Business'],
    },
    icon: {
      type: String,
      default: 'FileText',
    },
    contentType: {
      type: String,
      required: true,
      enum: ['blog', 'ad_copy', 'proposal', 'email', 'social', 'product'],
    },
    fields: [fieldSchema],
    promptStructure: {
      type: String,
      required: true,
      // Template string using {fieldName} placeholders
      // e.g. "Write a blog post about {topic} with keywords {keywords}..."
    },
    defaultTone: {
      type: String,
      default: 'professional',
    },
    defaultLength: {
      type: String,
      default: 'medium',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
)

templateSchema.index({ category: 1 })
templateSchema.index({ isActive: 1, isPublic: 1 })

// Increment usage on generation
templateSchema.methods.incrementUsage = async function () {
  this.usageCount += 1
  return this.save()
}

module.exports = mongoose.model('Template', templateSchema)
