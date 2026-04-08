const Template = require('../models/Template')
const { sendSuccess } = require('../utils/response')
const { createError, asyncHandler } = require('../utils/error')

/**
 * GET /api/templates
 */
const getTemplates = asyncHandler(async (req, res) => {
  const { category } = req.query

  const query = { isActive: true, isPublic: true }
  if (category) query.category = category

  const templates = await Template.find(query)
    .select('-promptStructure -createdBy') // hide internals from users
    .sort({ usageCount: -1, title: 1 })
    .lean()

  sendSuccess(res, { templates, total: templates.length }, 'Templates retrieved')
})

/**
 * GET /api/templates/:id
 */
const getTemplateById = asyncHandler(async (req, res, next) => {
  const template = await Template.findOne({ _id: req.params.id, isActive: true })
  if (!template) return next(createError(404, 'Template not found'))

  sendSuccess(res, { template }, 'Template retrieved')
})

/**
 * POST /api/templates  (admin only)
 */
const createTemplate = asyncHandler(async (req, res, next) => {
  const {
    title, description, category, contentType, fields,
    promptStructure, defaultTone, defaultLength, icon,
  } = req.body

  const existing = await Template.findOne({ title })
  if (existing) return next(createError(409, 'A template with this title already exists'))

  const template = await Template.create({
    title,
    description,
    category,
    contentType,
    fields: fields || [],
    promptStructure,
    defaultTone,
    defaultLength,
    icon,
    createdBy: req.user._id,
  })

  sendSuccess(res, { template }, 'Template created successfully', 201)
})

/**
 * PATCH /api/templates/:id  (admin only)
 */
const updateTemplate = asyncHandler(async (req, res, next) => {
  const template = await Template.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  )

  if (!template) return next(createError(404, 'Template not found'))

  sendSuccess(res, { template }, 'Template updated successfully')
})

/**
 * DELETE /api/templates/:id  (admin only) — soft delete
 */
const deleteTemplate = asyncHandler(async (req, res, next) => {
  const template = await Template.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  )

  if (!template) return next(createError(404, 'Template not found'))

  sendSuccess(res, {}, 'Template deactivated successfully')
})

module.exports = { getTemplates, getTemplateById, createTemplate, updateTemplate, deleteTemplate }
