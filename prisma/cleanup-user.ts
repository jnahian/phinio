/**
 * Interactive cleanup script — wipes the domain data (investments,
 * deposits, withdrawals, EMIs, EMI payments, notifications) for the profile
 * belonging to the given user email.
 *
 * The User, Session, Account, and Profile rows are preserved so the user
 * can still log in and start fresh.
 *
 * Run via: npm run db:cleanup:user
 */

import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { wipeProfileData } from '../src/lib/seed-fixtures.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const rl = readline.createInterface({ input, output })

async function ask(question: string): Promise<string> {
  const answer = await rl.question(question)
  return answer.trim()
}

async function main() {
  let email = ''
  while (!email) {
    email = (await ask('User email: ')).toLowerCase()
    if (!email) console.log('Email is required.')
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  })
  if (!user) {
    console.error(`\nNo user found with email "${email}".`)
    rl.close()
    process.exit(1)
  }
  if (!user.profile) {
    console.log(
      `\nUser ${user.email} has no profile yet — nothing to clean up.`,
    )
    rl.close()
    return
  }

  const profileId = user.profile.id
  console.log(`Found user: ${user.name} <${user.email}> (profile ${profileId})`)

  const [
    investmentCount,
    depositCount,
    withdrawalCount,
    emiCount,
    emiPaymentCount,
    notificationCount,
  ] = await Promise.all([
    prisma.investment.count({ where: { profileId } }),
    prisma.investmentDeposit.count({ where: { profileId } }),
    prisma.investmentWithdrawal.count({ where: { profileId } }),
    prisma.emi.count({ where: { profileId } }),
    prisma.emiPayment.count({ where: { profileId } }),
    prisma.notification.count({ where: { profileId } }).catch(() => 0),
  ])

  const total =
    investmentCount +
    depositCount +
    withdrawalCount +
    emiCount +
    emiPaymentCount +
    notificationCount

  if (total === 0) {
    console.log('\nNo domain data to delete. Profile is already clean.')
    rl.close()
    return
  }

  console.log('\nThe following rows will be deleted:')
  console.log(`  Investments:           ${investmentCount}`)
  console.log(`  Investment deposits:   ${depositCount}`)
  console.log(`  Investment withdrawals:${withdrawalCount}`)
  console.log(`  EMIs:                  ${emiCount}`)
  console.log(`  EMI payments:          ${emiPaymentCount}`)
  console.log(`  Notifications:         ${notificationCount}`)
  console.log(
    '\nThe User, Session, Account, and Profile rows will be preserved.',
  )

  const confirmation = await ask(
    `\nType the email "${user.email}" to confirm deletion: `,
  )
  if (confirmation.toLowerCase() !== user.email.toLowerCase()) {
    console.log('Email did not match. Aborting — nothing was deleted.')
    rl.close()
    return
  }

  await wipeProfileData(prisma, profileId)
  console.log('\nCleanup complete.')
  rl.close()
}

main()
  .catch((e) => {
    console.error(e)
    rl.close()
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
