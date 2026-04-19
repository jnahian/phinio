/**
 * Interactive seed script — prompts for a user email and lets you choose
 * which categories of test data to seed.
 *
 * Run via: npm run db:seed:user
 */

import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import {
  wipeProfileData,
  seedLumpSums,
  seedDps,
  seedSavings,
  seedEmis,
} from './seed-helpers.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const rl = readline.createInterface({ input, output })

async function ask(question: string): Promise<string> {
  const answer = await rl.question(question)
  return answer.trim()
}

async function askYesNo(question: string, defaultYes = true): Promise<boolean> {
  const suffix = defaultYes ? ' (Y/n) ' : ' (y/N) '
  const answer = (await ask(question + suffix)).toLowerCase()
  if (answer === '') return defaultYes
  return answer === 'y' || answer === 'yes'
}

async function main() {
  let email = ''
  while (!email) {
    email = (await ask('User email: ')).toLowerCase()
    if (!email) console.log('Email is required.')
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error(
      `\nNo user found with email "${email}". Sign up via the app first, then re-run this script.`,
    )
    rl.close()
    process.exit(1)
  }
  console.log(`Found user: ${user.name} <${user.email}>`)

  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      fullName: user.name,
      preferredCurrency: 'BDT',
    },
    update: {},
  })
  console.log(`Profile id: ${profile.id}\n`)

  const wipe = await askYesNo('Wipe existing data for this user first?', true)
  const doLumpSum = await askYesNo('Include lump-sum investments?', true)
  const doDps = await askYesNo('Include DPS (scheduled) investments?', true)
  const doSavings = await askYesNo('Include savings pots (flexible)?', true)
  const doEmis = await askYesNo('Include EMIs?', true)

  if (!doLumpSum && !doDps && !doSavings && !doEmis && !wipe) {
    console.log('\nNothing selected. Exiting.')
    rl.close()
    return
  }

  console.log('')

  if (wipe) {
    await wipeProfileData(prisma, profile.id)
    console.log('Cleared existing domain data.')
  }

  if (doLumpSum) await seedLumpSums(prisma, profile.id)
  if (doDps) await seedDps(prisma, profile.id)
  if (doSavings) await seedSavings(prisma, profile.id)
  if (doEmis) await seedEmis(prisma, profile.id)

  console.log('\nSeed complete.')
  rl.close()
}

main()
  .catch((e) => {
    console.error(e)
    rl.close()
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
