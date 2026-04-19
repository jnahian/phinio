import { prisma } from '#/db'
import {
  wipeProfileData,
  seedLumpSums,
  seedDps,
  seedSavings,
  seedEmis,
} from '#/lib/seed-fixtures'

export interface SeedCategories {
  lumpSum: boolean
  dps: boolean
  savings: boolean
  emis: boolean
}

export interface SeedProfileInput {
  categories: SeedCategories
  wipe: boolean
}

export interface DevDataResult {
  investments: number
  deposits: number
  withdrawals: number
  emis: number
  emiPayments: number
  notifications: number
}

async function requireProfileId(userId: string): Promise<string> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!profile) throw new Error('Profile not found')
  return profile.id
}

async function countProfileData(profileId: string): Promise<DevDataResult> {
  const [
    investments,
    deposits,
    withdrawals,
    emis,
    emiPayments,
    notifications,
  ] = await Promise.all([
    prisma.investment.count({ where: { profileId } }),
    prisma.investmentDeposit.count({ where: { profileId } }),
    prisma.investmentWithdrawal.count({ where: { profileId } }),
    prisma.emi.count({ where: { profileId } }),
    prisma.emiPayment.count({ where: { profileId } }),
    prisma.notification.count({ where: { profileId } }).catch(() => 0),
  ])
  return {
    investments,
    deposits,
    withdrawals,
    emis,
    emiPayments,
    notifications,
  }
}

export async function seedProfileDataImpl(
  userId: string,
  input: SeedProfileInput,
): Promise<DevDataResult> {
  const profileId = await requireProfileId(userId)

  if (input.wipe) {
    await wipeProfileData(prisma, profileId)
  }
  if (input.categories.lumpSum) await seedLumpSums(prisma, profileId)
  if (input.categories.dps) await seedDps(prisma, profileId)
  if (input.categories.savings) await seedSavings(prisma, profileId)
  if (input.categories.emis) await seedEmis(prisma, profileId)

  return countProfileData(profileId)
}

export async function cleanupProfileDataImpl(
  userId: string,
): Promise<DevDataResult> {
  const profileId = await requireProfileId(userId)
  await wipeProfileData(prisma, profileId)
  return countProfileData(profileId)
}
