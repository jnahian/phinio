import type { ComponentProps } from 'react'
import { TextField } from './TextField'
import { applyAmountEdit, formatAmountInput } from '#/lib/amount-input'
import { getCurrencySymbol } from '#/lib/currency'
import type { Currency } from '#/lib/currency'
import { useFormatter } from '#/lib/i18n/useFormatter'

type AmountFieldProps = Omit<
  ComponentProps<typeof TextField>,
  'value' | 'onChange' | 'prefix' | 'inputMode'
> & {
  value: string
  onValueChange: (value: string) => void
  currency: Currency
}

/**
 * A money input that groups digits as you type or paste ("1,234,567.5") but
 * reports the plain amount ("1234567.5"), so validators and server functions
 * see the same strings as before.
 */
export function AmountField({
  value,
  onValueChange,
  currency,
  ...props
}: AmountFieldProps) {
  const { locale } = useFormatter()
  return (
    <TextField
      {...props}
      inputMode="decimal"
      prefix={getCurrencySymbol(currency)}
      value={formatAmountInput(value, currency, locale)}
      onChange={(e) => {
        const input = e.target
        const edit = applyAmountEdit(
          input.value,
          input.selectionStart ?? input.value.length,
          value,
          (e.nativeEvent as InputEvent).inputType,
          currency,
          locale,
        )
        // Write the regrouped text now. React then renders the same text,
        // leaves the DOM value alone, and the caret stays where it's put.
        input.value = edit.display
        input.setSelectionRange(edit.caret, edit.caret)
        onValueChange(edit.raw)
      }}
    />
  )
}
