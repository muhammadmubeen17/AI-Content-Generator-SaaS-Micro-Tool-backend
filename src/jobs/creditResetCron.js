const cron = require('node-cron')
const User = require('../models/User')
const { resetMonthlyCredits, applyPlan } = require('../services/creditService')

/**
 * Monthly credit reset and plan expiry cron job
 */
const startCreditResetCron = () => {
  // Run daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running daily billing check...')

    try {
      // 1. Handle Monthly Credit Resets (mostly for Free users)
      const usersToReset = await User.find({
        creditsResetAt: { $lte: new Date() },
        subscriptionStatus: { $ne: 'cancelling' }, // Reset date will be overridden by expiry if cancelling
        isActive: true,
      }).select('_id email plan creditsResetAt')

      for (const user of usersToReset) {
        try {
          await resetMonthlyCredits(user._id)
          console.log(`[CRON] ✅ Credits reset for ${user.email}`)
        } catch (err) {
          console.error(`[CRON] ❌ Failed reset for ${user.email}:`, err.message)
        }
      }

      // 2. Handle Plan Expiries (for users who clicked Downgrade)
      const expiredUsers = await User.find({
        subscriptionStatus: 'cancelling',
        planExpiresAt: { $lte: new Date() },
        isActive: true,
      }).select('_id email')

      for (const user of expiredUsers) {
        try {
          await applyPlan(user._id, 'free')
          console.log(`[CRON] 📉 Plan expired: ${user.email} moved to Free.`)
        } catch (err) {
          console.error(`[CRON] ❌ Expiry failed for ${user.email}:`, err.message)
        }
      }

      console.log('[CRON] Billing check complete.')
    } catch (err) {
      console.error('[CRON] Job failed:', err.message)
    }
  })

  console.log('⏰ Billing cron job scheduled (daily at midnight)')
}

module.exports = { startCreditResetCron }
