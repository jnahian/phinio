import { randomBytes } from 'node:crypto'
import { prisma } from '#/db'

export { prisma }

export async function resetDb() {
  // Order matters only if RESTART IDENTITY mattered; CASCADE makes it moot.
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "push_subscriptions", "notifications", "emi_payments", "emis", "investment_withdrawals", "investment_deposits", "investments", "profiles", "verification", "account", "session", "user" RESTART IDENTITY CASCADE`,
  )
}

function rid(prefix: string) {
  return `${prefix}_${randomBytes(6).toString('hex')}`
}

export interface TestUser {
  userId: string
  profileId: string
  email: string
}

export async function createTestUser(
  overrides: {
    email?: string
    fullName?: string
    preferredCurrency?: 'BDT' | 'USD'
  } = {},
): Promise<TestUser> {
  const userId = rid('user')
  const email = overrides.email ?? `${userId}@phinio.test`
  const fullName = overrides.fullName ?? 'Test User'
  const preferredCurrency = overrides.preferredCurrency ?? 'BDT'

  await prisma.user.create({
    data: {
      id: userId,
      name: fullName,
      email,
      emailVerified: true,
      preferredCurrency,
      updatedAt: new Date(),
    },
  })

  const profile = await prisma.profile.create({
    data: {
      userId,
      fullName,
      preferredCurrency,
    },
  })

  return { userId, profileId: profile.id, email }
}
