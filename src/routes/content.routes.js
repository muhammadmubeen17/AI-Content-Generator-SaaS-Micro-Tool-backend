const express = require('express')
const router = express.Router()

const {
  generate,
  getHistory,
  getContentById,
  deleteContent,
  toggleFavorite,
  getStats,
} = require('../controllers/content.controller')
const { protect } = require('../middleware/auth')
const validate = require('../middleware/validate')
const { generateLimiter } = require('../middleware/rateLimiter')
const {
  generateValidator,
  historyQueryValidator,
  contentIdValidator,
} = require('../validators/content.validators')

// All routes require auth
router.use(protect)

router.post('/generate', generateLimiter, generateValidator, validate, generate)
router.get('/history', historyQueryValidator, validate, getHistory)
router.get('/stats', getStats)
router.get('/:id', contentIdValidator, validate, getContentById)
router.delete('/:id', contentIdValidator, validate, deleteContent)
router.patch('/:id/favorite', contentIdValidator, validate, toggleFavorite)

module.exports = router
