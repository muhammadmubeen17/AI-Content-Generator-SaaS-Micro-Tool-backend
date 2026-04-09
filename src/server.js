require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const connectDB = require('./config/db')
const { generalLimiter } = require('./middleware/rateLimiter')
const { errorHandler, notFound } = require('./middleware/errorHandler')
const { handleWebhook } = require('./controllers/billing.controller')
const { startCreditResetCron } = require('./jobs/creditResetCron')

// ─── Import routes ────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth.routes')
const contentRoutes = require('./routes/content.routes')
const templateRoutes = require('./routes/template.routes')
const billingRoutes = require('./routes/billing.routes')
const userRoutes = require('./routes/user.routes')

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
connectDB()

const app = express()

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
)

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
]

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`CORS policy: origin '${origin}' not allowed`))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

// ─── Stripe webhook — MUST come before express.json() ────────────────────────
// Stripe sends raw body; express.json() would parse and break signature verification
app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  handleWebhook
)

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true, limit: '10kb' }))

// ─── Request logging ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'))
} else {
  app.use(morgan('combined'))
}

// ─── Global rate limiter ──────────────────────────────────────────────────────
app.use('/api', generalLimiter)

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  })
})

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/content', contentRoutes)
app.use('/api/templates', templateRoutes)
app.use('/api/billing', billingRoutes)
app.use('/api/user', userRoutes)

// ─── 404 & Error handling ─────────────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
  console.log(`📡 API available at: http://localhost:${PORT}/api`)
  console.log(`❤️  Health check: http://localhost:${PORT}/health\n`)

  // Start cron jobs
  startCreditResetCron()
})

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`)
  server.close(() => {
    console.log('✅ HTTP server closed')
    process.exit(0)
  })

  // Force close after 10s
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err.message)
  server.close(() => process.exit(1))
})

module.exports = app
