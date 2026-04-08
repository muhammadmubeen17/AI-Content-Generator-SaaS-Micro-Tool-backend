const express = require('express')
const router = express.Router()

const {
  getProfile,
  updateProfile,
  getCredits,
  adminAddCredits,
  getDashboardStats,
  getAllUsers,
} = require('../controllers/user.controller')
const { protect, authorize } = require('../middleware/auth')
const { body } = require('express-validator')
const validate = require('../middleware/validate')

const updateProfileValidator = [
  body('name').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters'),
  body('email').optional().isEmail().withMessage('Invalid email').normalizeEmail(),
]

const addCreditsValidator = [
  body('userId').notEmpty().isMongoId().withMessage('Valid userId required'),
  body('amount').notEmpty().isInt({ min: 1, max: 10000 }).withMessage('Amount must be 1–10000'),
]

// All protected
router.use(protect)

router.get('/profile', getProfile)
router.patch('/profile', updateProfileValidator, validate, updateProfile)
router.get('/credits', getCredits)
router.get('/dashboard-stats', getDashboardStats)

// Admin routes
router.post('/add-credits', authorize('admin'), addCreditsValidator, validate, adminAddCredits)
router.get('/all', authorize('admin'), getAllUsers)

module.exports = router
