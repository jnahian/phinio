/**
 * EMI (Equated Monthly Installment) calculator per PRD §9.2.
 *
 * EMI = P × r × (1+r)^n / ((1+r)^n - 1)
 *   where r = annual_interest_rate / 12 / 100 and n = tenure in months.
 *   When r is 0, the formula degenerates to EMI = P / n.
 *
 * All return values are strings with exactly 2 decimal places so the caller
 * can hand them directly to Prisma's Decimal columns. The floating-point
 * calculation is contained inside this module — never propagate JS numbers
 * for money past this boundary.
 *
 * Rounding strategy: each month's interest and principal are rounded to 2
 * decimals independently, and the FINAL payment absorbs any residual balance
 * so remainingBalance lands on exactly 0.00. This matches how banks present
 * amortization schedules and avoids -0.01 / +0.03 drift at the end.
 */

export interface CalculateEmiInput {
  principal: string | number
  annualRate: string | number // percent, e.g. 12 for 12%
  tenureMonths: number
}

export interface EmiBreakdown {
  /** Rounded monthly EMI, 2 decimals. */
  emiAmount: string
  /** Total paid over the full schedule, 2 decimals. */
  totalPayment: string
  /** Total interest paid = totalPayment - principal, 2 decimals. */
  totalInterest: string
}

export interface AmortizationRow {
  paymentNumber: number
  dueDate: Date
  emiAmount: string
  principalComponent: string
  interestComponent: string
  remainingBalance: string
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Compute the monthly EMI, total payment, and total interest for a loan.
 * Useful for the Add EMI form's live preview card.
 */
export function calculateEmi(input: CalculateEmiInput): EmiBreakdown {
  const principal = toNumber(input.principal)
  const annualRate = toNumber(input.annualRate)
  const n = input.tenureMonths

  if (!Number.isFinite(principal) || principal <= 0) {
    throw new Error('Principal must be greater than 0')
  }
  if (!Number.isFinite(annualRate) || annualRate < 0) {
    throw new Error('Annual rate must be 0 or greater')
  }
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new Error('Tenure must be a positive integer')
  }

  const r = annualRate / 12 / 100

  let emi: number
  if (r === 0) {
    emi = principal / n
  } else {
    const pow = Math.pow(1 + r, n)
    emi = (principal * r * pow) / (pow - 1)
  }

  const emiRounded = round2(emi)
  const totalPayment = round2(emiRounded * n)
  const totalInterest = round2(totalPayment - principal)

  return {
    emiAmount: emiRounded.toFixed(2),
    totalPayment: totalPayment.toFixed(2),
    totalInterest: totalInterest.toFixed(2),
  }
}

/**
 * Add `months` calendar months to a date, preserving day-of-month when
 * possible and clamping to the end of the target month otherwise
 * (e.g. Jan 31 + 1 month → Feb 28/29). Operates in UTC so amortization
 * due dates are identical across server and client regardless of timezone.
 */
function addMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const targetDate = new Date(Date.UTC(year, month + months, day))
  // If JS rolled the date forward (e.g. Jan 31 → Mar 3), clamp to last day
  // of the intended month.
  const expectedMonth = (((month + months) % 12) + 12) % 12
  if (targetDate.getUTCMonth() !== expectedMonth) {
    return new Date(Date.UTC(year, month + months + 1, 0))
  }
  return targetDate
}

/**
 * Generate the full amortization schedule.
 *
 * Returns one row per month. The last row's principal component is forced to
 * consume whatever principal is still outstanding so remainingBalance === 0.00
 * after the final payment.
 */
export function generateAmortization(input: {
  principal: string | number
  annualRate: string | number
  tenureMonths: number
  startDate: Date
}): AmortizationRow[] {
  const principal = toNumber(input.principal)
  const annualRate = toNumber(input.annualRate)
  const n = input.tenureMonths
  const { emiAmount } = calculateEmi({
    principal,
    annualRate,
    tenureMonths: n,
  })
  const emi = Number(emiAmount)
  const r = annualRate / 12 / 100

  const rows: AmortizationRow[] = []
  let balance = principal

  for (let i = 1; i <= n; i++) {
    const isLast = i === n

    const interestComponent = round2(balance * r)
    let principalComponent: number
    let paymentAmount: number

    if (isLast) {
      // Force the final payment to clear the balance exactly.
      principalComponent = round2(balance)
      paymentAmount = round2(principalComponent + interestComponent)
      balance = 0
    } else {
      principalComponent = round2(emi - interestComponent)
      // Guard against tiny negative principal if interest > emi on a weird
      // rate/tenure combo (shouldn't happen in normal use, but be safe).
      if (principalComponent < 0) principalComponent = 0
      paymentAmount = emi
      balance = round2(balance - principalComponent)
    }

    rows.push({
      paymentNumber: i,
      dueDate: addMonths(input.startDate, i - 1),
      emiAmount: paymentAmount.toFixed(2),
      principalComponent: principalComponent.toFixed(2),
      interestComponent: interestComponent.toFixed(2),
      remainingBalance: balance.toFixed(2),
    })
  }

  return rows
}
