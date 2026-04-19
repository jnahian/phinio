/**
 * Seed script — populates the first user's profile with realistic test data.
 * Run via: npm run db:seed
 *
 * Safe to re-run: all domain data for the profile is deleted first so you
 * always get a clean slate.
 *
 * For seeding a specific user interactively, see `seed-user.ts`.
 */

import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  wipeProfileData,
  seedLumpSums,
  seedDps,
  seedSavings,
  seedEmis,
} from '../src/lib/seed-fixtures.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!user) {
    console.error('No users found. Sign up first, then run this seed.')
    process.exit(1)
  }
  console.log(`Seeding data for: ${user.email} (${user.name})`)

  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      fullName: user.name,
      preferredCurrency: 'BDT',
    },
    update: {
      fullName: user.name,
      preferredCurrency: 'BDT',
    },
  })
  console.log(`Profile id: ${profile.id}`)

  await wipeProfileData(prisma, profile.id)
  console.log('Cleared existing domain data.')

  await seedLumpSums(prisma, profile.id)
  await seedDps(prisma, profile.id)
  await seedSavings(prisma, profile.id)
  await seedEmis(prisma, profile.id)

  console.log('\nSeed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
