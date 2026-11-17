import { numberLocale } from './currency'
import type { Currency } from './currency'
import type { Locale } from './i18n/config'

// Digits and the decimal point: the characters that survive regrouping.
// Bengali digits (০-৯) count too, so a value copied in Bangla mode pastes.
const SIGNIFICANT = /[\d০-৯.]/

/**
 * The plain amount string ("150000.5") for whatever is in the field: Bengali
 * digits become Latin, separators and symbols go, a second '.' is dropped,
 * leading zeros go, and the fraction is cut to 2 digits.
 */
export function parseAmountInput(text: string): string {
  const s = text
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/[^\d.]/g, '')
  const dot = s.indexOf('.')
  const int = (dot === -1 ? s : s.slice(0, dot)).replace(/^0+(?=\d)/, '')
  if (dot === -1) return int
  return `${int}.${s
    .slice(dot + 1)
    .replace(/\./g, '')
    .slice(0, 2)}`
}

/**
 * Group the integer part with the same separators formatCurrency uses, in
 * Latin digits (what the keyboard types). The fraction is left as typed, so
 * "1234." and "1234.50" survive mid-entry.
 */
export function formatAmountInput(
  raw: string,
  currency: Currency,
  locale: Locale,
): string {
  const dot = raw.indexOf('.')
  const int = dot === -1 ? raw : raw.slice(0, dot)
  const grouped =
    int === ''
      ? ''
      : new Intl.NumberFormat(numberLocale(currency, locale), {
          numberingSystem: 'latn',
        }).format(BigInt(int))
  return dot === -1 ? grouped : grouped + raw.slice(dot)
}

/**
 * Work out the new value after a keystroke or paste. `text` and `caret` are
 * what the browser left in the field, `prevRaw` the value before the edit,
 * `inputType` the InputEvent's. The caret is put back after the same number
 * of digits it followed, so regrouping doesn't move it.
 */
export function applyAmountEdit(
  text: string,
  caret: number,
  prevRaw: string,
  inputType: string | undefined,
  currency: Currency,
  locale: Locale,
): { raw: string; display: string; caret: number } {
  let before = [...text.slice(0, caret)].filter((c) =>
    SIGNIFICANT.test(c),
  ).length
  let raw = parseAmountInput(text)

  // Deleting a separator alone changes nothing, and regrouping would put it
  // straight back, so delete the digit next to it instead.
  if (raw === prevRaw && inputType === 'deleteContentBackward' && before > 0) {
    raw = parseAmountInput(raw.slice(0, before - 1) + raw.slice(before))
    before -= 1
  } else if (raw === prevRaw && inputType === 'deleteContentForward') {
    raw = parseAmountInput(raw.slice(0, before) + raw.slice(before + 1))
  }

  const display = formatAmountInput(raw, currency, locale)
  let pos = 0
  while (before > 0 && pos < display.length) {
    if (SIGNIFICANT.test(display[pos])) before -= 1
    pos += 1
  }
  return { raw, display, caret: pos }
}
