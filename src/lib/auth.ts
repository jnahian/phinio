import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { Resend } from 'resend'
import { prisma } from '#/db'

const resendApiKey = process.env.RESEND_API_KEY
const resendFrom = process.env.RESEND_FROM ?? 'Phinio <onboarding@resend.dev>'
const resend = resendApiKey ? new Resend(resendApiKey) : null

async function sendMail(args: {
  to: string
  subject: string
  text: string
  logLabel: string
  url: string
}) {
  if (!resend) {
    console.warn(
      `[auth] RESEND_API_KEY not set — ${args.logLabel} for ${args.to}: ${args.url}`,
    )
    return
  }
  await resend.emails.send({
    from: resendFrom,
    to: args.to,
    subject: args.subject,
    text: args.text,
  })
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // With requireEmailVerification on, Better Auth skips the auto sign-in
    // and returns the user without a session until they click the link.
    autoSignIn: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: 'Reset your Phinio password',
        text: `Click the link below to reset your password:\n\n${url}\n\nIf you didn't request this, you can safely ignore this email.`,
        logLabel: 'reset link',
        url,
      })
    },
  },
  emailVerification: {
    // Fire the verification email as soon as the user signs up, and re-send
    // it if they try to sign in before clicking the link.
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60, // 1 hour
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: 'Verify your Phinio email',
        text: `Welcome to Phinio! Click the link below to verify your email and finish setting up your account:\n\n${url}\n\nThe link expires in 1 hour. If you didn't create an account, you can ignore this email.`,
        logLabel: 'verification link',
        url,
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
