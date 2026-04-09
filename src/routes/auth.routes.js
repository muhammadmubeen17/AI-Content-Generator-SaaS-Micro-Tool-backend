const express = require('express')
const router = express.Router()

const { register, login, getMe, logout, changePassword, verifyEmail, resendVerification } = require('../controllers/auth.controller')
const { protect } = require('../middleware/auth')
const validate = require('../middleware/validate')
const { authLimiter } = require('../middleware/rateLimiter')
const {
  registerValidator,
  loginValidator,
  changePasswordValidator,
} = require('../validators/auth.validators')

// Public
router.post('/register', authLimiter, ...registerValidator, validate, register)
router.post('/login', authLimiter, ...loginValidator, validate, login)
router.post('/logout', logout)
router.get('/verify-email/:token', verifyEmail)

// Protected
router.get('/me', protect, getMe)
router.patch('/change-password', protect, ...changePasswordValidator, validate, changePassword)
router.post('/resend-verification', protect, resendVerification)

module.exports = router
