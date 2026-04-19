/**
 * Shared seed fixtures and per-category seeding functions.
 * Consumed by `seed.ts` (first-user, all categories) and
 * `seed-user.ts` (interactive, email-scoped, selective).
 */

import type { PrismaClient } from '../src/generated/prisma/client.js'
import {
  generateAmortization,
  calculateEmi,
} from '../src/lib/emi-calculator.js'
import { generateDpsSchedule } from '../src/lib/dps-calculator.js'

function d(iso: string): Date {
  return new Date(iso)
}

function sumStrings(values: string[]): string {
  return values.reduce((acc, v) => acc + Number(v), 0).toFixed(2)
}

// ---------------------------------------------------------------------------
// Wipe
// ---------------------------------------------------------------------------

export async function wipeProfileData(prisma: PrismaClient, profileId: string) {
  await prisma.emi.deleteMany({ where: { profileId } })
  await prisma.investment.deleteMany({ where: { profileId } })
  try {
    await prisma.notification.deleteMany({ where: { profileId } })
  } catch {
    // notifications table may not exist yet — skip silently
  }
}

// ---------------------------------------------------------------------------
// Lump-sum investments (mode: 'lump_sum')
// ---------------------------------------------------------------------------

export async function seedLumpSums(prisma: PrismaClient, profileId: string) {
  const lumpSumInvestments = [
    {
      profileId,
      name: 'Square Pharmaceuticals',
      type: 'stock',
      mode: 'lump_sum',
      investedAmount: '150000.00',
      currentValue: '189500.00',
      dateOfInvestment: d('2024-01-15'),
      notes: 'Long-term hold — quarterly dividend payer',
      status: 'active',
    },
    {
      profileId,
      name: 'BRAC EPF Growth Fund',
      type: 'mutual_fund',
      mode: 'lump_sum',
      investedAmount: '200000.00',
      currentValue: '224800.00',
      dateOfInvestment: d('2023-07-01'),
      notes: 'Monthly SIP of ৳10,000',
      status: 'active',
    },
    {
      profileId,
      name: 'Dutch-Bangla Bank FD',
      type: 'fd',
      mode: 'lump_sum',
      investedAmount: '500000.00',
      currentValue: '549750.00',
      dateOfInvestment: d('2024-04-01'),
      notes: '12-month FD at 10.5% p.a.',
      status: 'active',
    },
    {
      profileId,
      name: '22K Gold (10 g)',
      type: 'gold',
      mode: 'lump_sum',
      investedAmount: '85000.00',
      currentValue: '97200.00',
      dateOfInvestment: d('2023-10-05'),
      notes: 'Physical gold stored at home locker',
      status: 'active',
    },
    {
      profileId,
      name: 'Bitcoin',
      type: 'crypto',
      mode: 'lump_sum',
      investedAmount: '60000.00',
      currentValue: '112000.00',
      dateOfInvestment: d('2024-06-10'),
      notes: '0.015 BTC — cold wallet',
      status: 'active',
    },
    {
      profileId,
      name: 'Grameenphone Ltd',
      type: 'stock',
      mode: 'lump_sum',
      investedAmount: '75000.00',
      currentValue: '68300.00',
      dateOfInvestment: d('2024-09-20'),
      status: 'active',
    },
    {
      profileId,
      name: 'Islami Bank FD',
      type: 'fd',
      mode: 'lump_sum',
      investedAmount: '300000.00',
      currentValue: '300000.00',
      dateOfInvestment: d('2023-01-01'),
      notes: '12-month FD — matured and encashed',
      status: 'completed',
      exitValue: '333000.00',
      completedAt: d('2024-01-01'),
    },
    {
      profileId,
      name: 'Beximco Pharma — exited',
      type: 'stock',
      mode: 'lump_sum',
      investedAmount: '120000.00',
      currentValue: '0.00',
      dateOfInvestment: d('2024-02-10'),
      notes: 'Sold off in two tranches as price recovered',
      status: 'completed',
      exitValue: '142000.00',
      completedAt: d('2025-09-15'),
    },
  ]

  await prisma.investment.createMany({ data: lumpSumInvestments })

  const beximco = await prisma.investment.findFirst({
    where: { profileId, name: 'Beximco Pharma — exited' },
    select: { id: true },
  })
  if (beximco) {
    await prisma.investmentWithdrawal.createMany({
      data: [
        {
          investmentId: beximco.id,
          profileId,
          amount: '70000.00',
          withdrawalDate: d('2025-06-20'),
          notes: 'First tranche — ~half the position',
        },
        {
          investmentId: beximco.id,
          profileId,
          amount: '72000.00',
          withdrawalDate: d('2025-09-15'),
          notes: 'Final tranche — closed position',
        },
      ],
    })
  }

  console.log(`  Lump-sum: ${lumpSumInvestments.length} investments created.`)
}

// ---------------------------------------------------------------------------
// DPS investments (mode: 'scheduled')
// ---------------------------------------------------------------------------

type DpsSeed = {
  name: string
  monthlyDeposit: string
  tenureMonths: number
  interestRate: string
  interestType: 'simple' | 'compound'
  startDate: Date
  paidMonths: number
  notes?: string
  closedEarly?: { receivedAmount: string; closureDate: Date; notes?: string }
}

export async function seedDps(prisma: PrismaClient, profileId: string) {
  const dpsSeeds: DpsSeed[] = [
    {
      name: 'DBBL Monthly Savings Scheme',
      monthlyDeposit: '5000.00',
      tenureMonths: 36,
      interestRate: '7.50',
      interestType: 'simple',
      startDate: d('2024-01-01'),
      paidMonths: 15,
      notes: 'Dutch-Bangla Bank DPS — auto-debit on 1st of each month',
    },
    {
      name: 'Islami Bank DPS',
      monthlyDeposit: '3000.00',
      tenureMonths: 24,
      interestRate: '8.00',
      interestType: 'compound',
      startDate: d('2024-06-01'),
      paidMonths: 10,
      notes: 'Islami Bank — Mudaraba savings scheme',
    },
    {
      name: 'Mercantile Bank DPS',
      monthlyDeposit: '4000.00',
      tenureMonths: 36,
      interestRate: '7.00',
      interestType: 'simple',
      startDate: d('2024-03-01'),
      paidMonths: 9,
      notes: 'Closed prematurely after job change',
      closedEarly: {
        receivedAmount: '34500.00',
        closureDate: d('2024-12-15'),
        notes: 'Job-change emergency cash',
      },
    },
  ]

  for (const seed of dpsSeeds) {
    const schedule = generateDpsSchedule({
      monthlyDeposit: seed.monthlyDeposit,
      tenureMonths: seed.tenureMonths,
      annualRate: seed.interestRate,
      interestType: seed.interestType,
      startDate: seed.startDate,
    })

    const paidRows = schedule.slice(0, seed.paidMonths)
    const totalPaid = sumStrings(paidRows.map((r) => r.depositAmount))

    const inv = await prisma.investment.create({
      data: {
        profileId,
        name: seed.name,
        type: 'dps',
        mode: 'scheduled',
        investedAmount: totalPaid,
        currentValue: totalPaid,
        monthlyDeposit: seed.monthlyDeposit,
        tenureMonths: seed.tenureMonths,
        interestRate: seed.interestRate,
        interestType: seed.interestType,
        startDate: seed.startDate,
        notes: seed.notes,
        status: seed.paidMonths >= seed.tenureMonths ? 'matured' : 'active',
      },
    })

    await prisma.investmentDeposit.createMany({
      data: schedule.map((s) => ({
        investmentId: inv.id,
        profileId,
        installmentNumber: s.installmentNumber,
        dueDate: s.dueDate,
        amount: s.depositAmount,
        accruedValue: s.accruedValue,
        status: s.installmentNumber <= seed.paidMonths ? 'paid' : 'upcoming',
        paidAt:
          s.installmentNumber <= seed.paidMonths
            ? new Date(s.dueDate.getTime() + 3 * 24 * 60 * 60 * 1000)
            : null,
      })),
    })

    if (seed.closedEarly) {
      await prisma.investmentDeposit.deleteMany({
        where: { investmentId: inv.id, status: 'upcoming' },
      })
      await prisma.investment.update({
        where: { id: inv.id },
        data: {
          status: 'closed',
          currentValue: '0.00',
          exitValue: seed.closedEarly.receivedAmount,
          completedAt: seed.closedEarly.closureDate,
        },
      })
      await prisma.investmentWithdrawal.create({
        data: {
          investmentId: inv.id,
          profileId,
          amount: seed.closedEarly.receivedAmount,
          withdrawalDate: seed.closedEarly.closureDate,
          notes: `Premature closure. ${seed.closedEarly.notes ?? ''}`.trim(),
        },
      })
      console.log(
        `  DPS: ${seed.name} (${seed.tenureMonths}m, ${seed.paidMonths} paid) — closed early, received ৳${seed.closedEarly.receivedAmount}`,
      )
    } else {
      console.log(
        `  DPS: ${seed.name} (${seed.tenureMonths}m, ${seed.paidMonths} paid) — ৳${seed.monthlyDeposit}/month`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Savings pots (mode: 'flexible')
// ---------------------------------------------------------------------------

type SavingsSeed = {
  name: string
  startDate: Date
  currentValue: string
  notes?: string
  deposits: { amount: string; date: Date; notes?: string }[]
  withdrawals?: { amount: string; date: Date; notes?: string }[]
}

export async function seedSavings(prisma: PrismaClient, profileId: string) {
  const savingsSeeds: SavingsSeed[] = [
    {
      name: 'Emergency Fund',
      startDate: d('2024-01-01'),
      currentValue: '160000.00',
      notes: 'High-yield savings — target 6 months of expenses',
      deposits: [
        { amount: '50000.00', date: d('2024-01-05'), notes: 'Initial deposit' },
        { amount: '20000.00', date: d('2024-02-05'), notes: 'February top-up' },
        { amount: '20000.00', date: d('2024-03-05'), notes: 'March top-up' },
        { amount: '20000.00', date: d('2024-04-05'), notes: 'April top-up' },
        {
          amount: '30000.00',
          date: d('2024-06-01'),
          notes: 'Bonus allocation',
        },
        { amount: '20000.00', date: d('2024-08-05') },
        { amount: '20000.00', date: d('2024-10-05') },
      ],
      withdrawals: [
        {
          amount: '25000.00',
          date: d('2025-02-10'),
          notes: 'Laptop replacement',
        },
      ],
    },
    {
      name: 'Vacation Fund',
      startDate: d('2024-04-01'),
      currentValue: '62500.00',
      notes: "Cox's Bazar + Thailand trip savings",
      deposits: [
        { amount: '15000.00', date: d('2024-04-01'), notes: 'Initial' },
        { amount: '10000.00', date: d('2024-05-01') },
        { amount: '10000.00', date: d('2024-06-01') },
        { amount: '10000.00', date: d('2024-07-01') },
        { amount: '15000.00', date: d('2024-09-01'), notes: 'Extra push' },
      ],
    },
  ]

  for (const seed of savingsSeeds) {
    const totalDeposited = sumStrings(seed.deposits.map((dep) => dep.amount))

    const inv = await prisma.investment.create({
      data: {
        profileId,
        name: seed.name,
        type: 'savings',
        mode: 'flexible',
        investedAmount: totalDeposited,
        currentValue: seed.currentValue,
        startDate: seed.startDate,
        notes: seed.notes,
        status: 'active',
      },
    })

    await prisma.investmentDeposit.createMany({
      data: seed.deposits.map((dep) => ({
        investmentId: inv.id,
        profileId,
        amount: dep.amount,
        dueDate: dep.date,
        paidAt: dep.date,
        status: 'paid',
        notes: dep.notes,
      })),
    })

    if (seed.withdrawals?.length) {
      await prisma.investmentWithdrawal.createMany({
        data: seed.withdrawals.map((w) => ({
          investmentId: inv.id,
          profileId,
          amount: w.amount,
          withdrawalDate: w.date,
          notes: w.notes,
        })),
      })
    }

    const wdCount = seed.withdrawals?.length ?? 0
    console.log(
      `  Savings: ${seed.name} (${seed.deposits.length} deposits, ${wdCount} withdrawals, total deposited ৳${totalDeposited})`,
    )
  }
}

// ---------------------------------------------------------------------------
// EMIs
// ---------------------------------------------------------------------------

type EmiSeed = {
  label: string
  type: 'bank_loan' | 'credit_card'
  principal: string
  interestRate: string
  tenureMonths: number
  startDate: Date
  paidMonths?: number
}

export async function seedEmis(prisma: PrismaClient, profileId: string) {
  const emiSeeds: EmiSeed[] = [
    {
      label: 'Home Loan — BRAC Bank',
      type: 'bank_loan',
      principal: '3500000.00',
      interestRate: '9.00',
      tenureMonths: 240,
      startDate: d('2022-04-01'),
      paidMonths: 24,
    },
    {
      label: 'Car Loan — Toyota Axio',
      type: 'bank_loan',
      principal: '1200000.00',
      interestRate: '11.50',
      tenureMonths: 60,
      startDate: d('2023-06-01'),
      paidMonths: 10,
    },
    {
      label: 'Credit Card — Standard Chartered',
      type: 'credit_card',
      principal: '85000.00',
      interestRate: '24.00',
      tenureMonths: 12,
      startDate: d('2025-10-01'),
      paidMonths: 6,
    },
    {
      label: 'Personal Loan — Dutch-Bangla Bank',
      type: 'bank_loan',
      principal: '250000.00',
      interestRate: '13.00',
      tenureMonths: 24,
      startDate: d('2025-08-01'),
      paidMonths: 8,
    },
  ]

  for (const seed of emiSeeds) {
    const { emiAmount } = calculateEmi({
      principal: seed.principal,
      annualRate: seed.interestRate,
      tenureMonths: seed.tenureMonths,
    })
    const schedule = generateAmortization({
      principal: seed.principal,
      annualRate: seed.interestRate,
      tenureMonths: seed.tenureMonths,
      startDate: seed.startDate,
    })

    const emi = await prisma.emi.create({
      data: {
        profileId,
        label: seed.label,
        type: seed.type,
        principal: seed.principal,
        interestRate: seed.interestRate,
        tenureMonths: seed.tenureMonths,
        emiAmount,
        startDate: seed.startDate,
        status: 'active',
      },
    })

    const paidCount = seed.paidMonths ?? 0
    await prisma.emiPayment.createMany({
      data: schedule.map((row) => ({
        emiId: emi.id,
        profileId,
        paymentNumber: row.paymentNumber,
        dueDate: row.dueDate,
        emiAmount: row.emiAmount,
        principalComponent: row.principalComponent,
        interestComponent: row.interestComponent,
        remainingBalance: row.remainingBalance,
        status: row.paymentNumber <= paidCount ? 'paid' : 'upcoming',
        paidAt:
          row.paymentNumber <= paidCount
            ? new Date(row.dueDate.getTime() + 2 * 24 * 60 * 60 * 1000)
            : null,
      })),
    })

    console.log(
      `  EMI: ${seed.label} (${seed.tenureMonths} months, ${paidCount} paid) — EMI ৳${emiAmount}`,
    )
  }
}
