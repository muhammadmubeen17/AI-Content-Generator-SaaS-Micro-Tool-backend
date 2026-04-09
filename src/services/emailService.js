const { Resend } = require('resend')

let resendClient = null

const getResend = () => {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY
    if (key && !key.startsWith('your-') && !key.startsWith('re_placeholder')) {
      resendClient = new Resend(key)
    }
  }
  return resendClient
}

// ─── Email HTML template ──────────────────────────────────────────────────────

const buildVerificationHTML = ({ name, verifyUrl }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your ContentAI email</title>
</head>
<body style="margin:0;padding:40px 20px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr>
      <td>
        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:36px 40px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="display:inline-table;">
                <tr>
                  <td style="background:rgba(255,255,255,0.2);border-radius:12px;padding:10px 12px;vertical-align:middle;">
                    <span style="font-size:20px;color:white;">✦</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="color:white;font-size:22px;font-weight:700;letter-spacing:-0.5px;">ContentAI</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#111827;">Verify your email address</h1>
              <p style="margin:0 0 8px;font-size:15px;color:#4b5563;line-height:1.6;">Hi ${name},</p>
              <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.6;">
                Welcome to ContentAI! You're one step away from generating amazing content. Click the button below to verify your email and activate your account.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="border-radius:10px;background:#4f46e5;">
                    <a href="${verifyUrl}" target="_blank"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:10px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">
                    <span style="font-size:13px;color:#92400e;">⏰ This link expires in <strong>24 hours</strong>.</span>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">
                If you didn't create a ContentAI account, you can safely ignore this email.
              </p>

              <!-- Fallback link -->
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                Button not working? Copy and paste this link:<br/>
                <span style="color:#4f46e5;word-break:break-all;">${verifyUrl}</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © ${new Date().getFullYear()} ContentAI · You're receiving this because you signed up for ContentAI.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

// ─── Send verification email ──────────────────────────────────────────────────

const sendVerificationEmail = async ({ name, email, token }) => {
  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`
  const resend = getResend()

  if (!resend) {
    // Development fallback: log to console when no Resend key is configured
    console.log('\n📧 ─── [DEV] Email Verification ────────────────────')
    console.log(`   To:   ${email}`)
    console.log(`   Link: ${verifyUrl}`)
    console.log('────────────────────────────────────────────────────\n')
    return
  }

  const from = process.env.FROM_EMAIL || 'ContentAI <onboarding@resend.dev>'

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: 'Verify your ContentAI email address',
    html: buildVerificationHTML({ name, verifyUrl }),
  })

  if (error) throw new Error(`Resend error: ${error.message}`)
}

module.exports = { sendVerificationEmail }
