const Content = require('../models/Content')
const Template = require('../models/Template')
const { generateContent: aiGenerate } = require('../services/aiService')
const { calculateCost, deductCredits } = require('../services/creditService')
const { sendSuccess, sendPaginatedResponse } = require('../utils/response')
const { createError, asyncHandler } = require('../utils/error')

/**
 * POST /api/content/generate
 */
const generate = asyncHandler(async (req, res, next) => {
  const { contentType, tone, length, prompt, templateId } = req.body
  const userId = req.user._id

  // 1. Require verified email
  if (!req.user.isEmailVerified) {
    return next(createError(403, 'Please verify your email address before generating content.'))
  }

  // 2. Calculate cost and verify credits
  const cost = calculateCost(length)
  if (!req.user.hasEnoughCredits(cost)) {
    return next(
      createError(402, `Insufficient credits. Need ${cost}, have ${req.user.credits}. Please upgrade your plan.`)
    )
  }

  // 3. Resolve template if provided
  let template = null
  if (templateId) {
    template = await Template.findById(templateId)
    if (!template) return next(createError(404, 'Template not found'))
  }

  // 3. Generate content via AI service
  const { output, tokensUsed, source } = await aiGenerate({
    contentType,
    tone,
    length,
    prompt,
    templateId,
  })

  // 4. Deduct credits atomically (prevents race conditions)
  await deductCredits(userId, cost)

  // 5. Persist the generated content
  const content = await Content.create({
    userId,
    type: contentType,
    tone,
    length,
    prompt,
    output,
    tokensUsed,
    creditsDeducted: cost,
    templateId: template?._id || null,
    metadata: { source },
  })

  // 6. Increment template usage count if applicable
  if (template) {
    await template.incrementUsage()
  }

  sendSuccess(
    res,
    {
      content: {
        id: content._id,
        type: content.type,
        tone: content.tone,
        length: content.length,
        prompt: content.prompt,
        output: content.output,
        wordCount: content.wordCount,
        tokensUsed: content.tokensUsed,
        creditsDeducted: cost,
        createdAt: content.createdAt,
      },
      creditsRemaining: req.user.credits - cost,
    },
    'Content generated successfully',
    201
  )
})

/**
 * GET /api/content/history
 */
const getHistory = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const limit = parseInt(req.query.limit) || 10
  const { type, search } = req.query
  const skip = (page - 1) * limit

  // Build query
  const query = { userId: req.user._id }
  if (type) query.type = type
  if (search) {
    query.$or = [
      { prompt: { $regex: search, $options: 'i' } },
      { output: { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } },
    ]
  }

  const [data, total] = await Promise.all([
    Content.find(query)
      .select('-output') // exclude heavy output field from list
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Content.countDocuments(query),
  ])

  sendPaginatedResponse(res, { data, total, page, limit }, 'History retrieved')
})

/**
 * GET /api/content/:id
 */
const getContentById = asyncHandler(async (req, res, next) => {
  const content = await Content.findOne({
    _id: req.params.id,
    userId: req.user._id,
  })

  if (!content) return next(createError(404, 'Content not found'))

  sendSuccess(res, { content }, 'Content retrieved')
})

/**
 * DELETE /api/content/:id
 */
const deleteContent = asyncHandler(async (req, res, next) => {
  const content = await Content.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  })

  if (!content) return next(createError(404, 'Content not found'))

  sendSuccess(res, {}, 'Content deleted successfully')
})

/**
 * PATCH /api/content/:id/favorite
 */
const toggleFavorite = asyncHandler(async (req, res, next) => {
  const content = await Content.findOne({ _id: req.params.id, userId: req.user._id })
  if (!content) return next(createError(404, 'Content not found'))

  content.isFavorited = !content.isFavorited
  await content.save()

  sendSuccess(res, { isFavorited: content.isFavorited }, `Content ${content.isFavorited ? 'favorited' : 'unfavorited'}`)
})

/**
 * GET /api/content/stats
 */
const getStats = asyncHandler(async (req, res) => {
  const [stats, totalCount] = await Promise.all([
    Content.getUserStats(req.user._id),
    Content.countDocuments({ userId: req.user._id }),
  ])

  sendSuccess(res, { stats, total: totalCount }, 'Stats retrieved')
})

module.exports = { generate, getHistory, getContentById, deleteContent, toggleFavorite, getStats }
