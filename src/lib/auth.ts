import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { Resend } from 'resend'
import { prisma } from '#/db'

const resendApiKey = process.env.RESEND_API_KEY
const resendFrom = process.env.RESEND_FROM ?? 'Phinio <onboarding@resend.dev>'
const resend = resendApiKey ? new Resend(resendApiKey) : null

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      if (!resend) {
        console.warn(
          `[auth] RESEND_API_KEY not set — reset link for ${user.email}: ${url}`,
        )
        return
      }
      await resend.emails.send({
        from: resendFrom,
        to: user.email,
        subject: 'Reset your Phinio password',
        text: `Click the link below to reset your password:\n\n${url}\n\nIf you didn't request this, you can safely ignore this email.`,
      })
    },
  },
  user: {
    additionalFields: {
      preferredCurrency: {
        type: 'string',
        required: true,
        defaultValue: 'BDT',
        input: true,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await prisma.profile.create({
            data: {
              userId: user.id,
              fullName: user.name,
              preferredCurrency:
                (user as { preferredCurrency?: string }).preferredCurrency ??
                'BDT',
            },
          })
        },
      },
    },
  },
  plugins: [tanstackStartCookies()],
})
