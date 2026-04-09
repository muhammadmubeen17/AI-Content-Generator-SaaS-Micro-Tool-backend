const cron = require('node-cron')
const User = require('../models/User')
const { resetMonthlyCredits } = require('../services/creditService')

/**
 * Monthly credit reset cron job
 * Runs every day at midnight and resets credits for users whose creditsResetAt date has passed.
 * This covers FREE plan users (paid plans are reset via Stripe invoice webhook).
 */
const startCreditResetCron = () => {
  // Run daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running daily credit reset check...')

    try {
      // Find users whose credits need resetting (reset date has passed)
      const usersToReset = await User.find({
        creditsResetAt: { $lte: new Date() },
        isActive: true,
      }).select('_id email plan creditsResetAt')

      if (usersToReset.length === 0) {
        console.log('[CRON] No users need credit reset.')
        return
      }

      let resetCount = 0
      for (const user of usersToReset) {
        try {
          await resetMonthlyCredits(user._id)
          resetCount++
          console.log(`[CRON] ✅ Credits reset for ${user.email} (${user.plan} plan)`)
        } catch (err) {
          console.error(`[CRON] ❌ Failed to reset credits for ${user.email}:`, err.message)
        }
      }

      console.log(`[CRON] Credit reset complete: ${resetCount}/${usersToReset.length} users reset.`)
    } catch (err) {
      console.error('[CRON] Credit reset job failed:', err.message)
    }
  })

  console.log('⏰ Credit reset cron job scheduled (daily at midnight)')
}

module.exports = { startCreditResetCron }
