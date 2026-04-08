const express = require('express')
const router = express.Router()

const {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} = require('../controllers/template.controller')
const { protect, authorize } = require('../middleware/auth')

// Public: list templates
router.get('/', getTemplates)
router.get('/:id', getTemplateById)

// Admin only
router.post('/', protect, authorize('admin'), createTemplate)
router.patch('/:id', protect, authorize('admin'), updateTemplate)
router.delete('/:id', protect, authorize('admin'), deleteTemplate)

module.exports = router
