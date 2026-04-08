const express = require('express')
const router = express.Router()

const { createSession, handleWebhook, getTransactions } = require('../controllers/billing.controller')
const { protect } = require('../middleware/auth')

// Webhook: raw body required (registered before express.json in server.js)
// This route is handled specially in server.js with express.raw()

router.post('/create-checkout-session', protect, createSession)
router.get('/transactions', protect, getTransactions)

// The /webhook route is attached in server.js directly with raw body parser
module.exports = router
