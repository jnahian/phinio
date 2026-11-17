import { useEffect, useState } from 'react'
import NumberFlow from '@number-flow/react'
import { getCurrencySymbol, numberLocale } from '#/lib/currency'
import type { Currency } from '#/lib/currency'
import { NUMBER_LOCALE } from '#/lib/i18n/config'
import { useFormatter } from '#/lib/i18n/useFormatter'

const TWO_DECIMALS = { minimumFractionDigits: 2, maximumFractionDigits: 2 }

// NumberFlow pads the number above and below for its fade mask. Pull that
// back so it's exactly as tall as the text it replaces, with no layout shift.
const FLUSH = {
  marginBlock: 'calc(var(--number-flow-mask-height, 0.25em) * -1)',
}

// Numbers that have already rolled in during this page load. Mounting one
// again (back to the dashboard) starts at its value; later value changes
// still roll, since NumberFlow animates every update.
const rolledIn = new Set<string>()

// Show 0 on the first mount of `id`, then the real value a frame later, so
// NumberFlow rolls the digits in.
function useRollIn(id: string, value: number): number {
  const [shown, setShown] = useState(() => (rolledIn.has(id) ? value : 0))
  useEffect(() => {
    rolledIn.add(id)
    const frame = requestAnimationFrame(() => setShown(value))
    return () => cancelAnimationFrame(frame)
  }, [id, value])
  return shown
}

// NumberFlow can only draw Latin digits, so Bangla mode keeps the static
// text with Bengali numerals. Screen readers get the final value from a
// hidden span; NumberFlow's digits read out one by one otherwise.

/** A money amount that rolls its digits in, matching `fmt.currency`. */
export function RollingCurrency({
  id,
  amount,
  currency,
}: {
  id: string
  amount: string
  currency: Currency
}) {
  const fmt = useFormatter()
  const value = Number(amount)
  const shown = useRollIn(id, Math.abs(value))
  const text = fmt.currency(amount, currency)
  if (fmt.locale === 'bn') return text
  return (
    <>
      <span className="sr-only">{text}</span>
      <NumberFlow
        aria-hidden="true"
        style={FLUSH}
        value={shown}
        locales={numberLocale(currency, 'en')}
        format={TWO_DECIMALS}
        prefix={(value < 0 ? '-' : '') + getCurrencySymbol(currency)}
      />
    </>
  )
}

/** A percentage that rolls its digits in, matching `fmt.percent`. */
export function RollingPercent({
  id,
  value,
  showSign,
}: {
  id: string
  value: number
  showSign?: boolean
}) {
  const fmt = useFormatter()
  const shown = useRollIn(id, Math.abs(value))
  const text = fmt.percent(value, { showSign })
  if (fmt.locale === 'bn') return text
  return (
    <>
      <span className="sr-only">{text}</span>
      <NumberFlow
        aria-hidden="true"
        style={FLUSH}
        value={shown}
        locales={NUMBER_LOCALE.en}
        format={TWO_DECIMALS}
        prefix={value < 0 ? '-' : showSign && value > 0 ? '+' : ''}
        suffix="%"
      />
    </>
  )
}
