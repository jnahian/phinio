export interface DpsInstallmentRow {
  installmentNumber: number
  dueDate: Date
  depositAmount: string
  accruedValue: string
}

/**
 * Generate the full DPS deposit schedule upfront.
 *
 * Simple interest:  accruedValue(n) = D·n + D·(r/12)·n·(n+1)/2
 *   Each deposit earns interest from the month it was made through month n.
 *
 * Compound interest: accruedValue(n) = D·(1+r)·[(1+r)^n − 1] / r
 *   where r = annualRate / 1200 (monthly rate).
 *   Interest compounds on the total accumulated balance each month.
 */
export function generateDpsSchedule(params: {
  monthlyDeposit: string
  tenureMonths: number
  annualRate: string
  interestType: 'simple' | 'compound'
  startDate: Date
}): DpsInstallmentRow[] {
  const D = Number(params.monthlyDeposit)
  const T = params.tenureMonths
  const r = Number(params.annualRate) / 1200 // monthly rate
  const rows: DpsInstallmentRow[] = []

  for (let n = 1; n <= T; n++) {
    const dueDate = new Date(params.startDate)
    dueDate.setMonth(dueDate.getMonth() + (n - 1))

    let accruedValue: number
    if (params.interestType === 'compound') {
      if (r === 0) {
        accruedValue = D * n
      } else {
        // Future value of annuity-due: D·(1+r)·[(1+r)^n − 1] / r
        accruedValue = (D * (1 + r) * (Math.pow(1 + r, n) - 1)) / r
      }
    } else {
      // Simple interest: total deposited + interest on each deposit up to now
      // = D·n + D·r·[n + (n-1) + … + 1] = D·n + D·r·n·(n+1)/2
      accruedValue = D * n + D * r * ((n * (n + 1)) / 2)
    }

    rows.push({
      installmentNumber: n,
      dueDate,
      depositAmount: D.toFixed(2),
      accruedValue: accruedValue.toFixed(2),
    })
  }

  return rows
}
