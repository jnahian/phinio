import { describe, expect, it } from 'vitest'
import {
  applyAmountEdit,
  formatAmountInput,
  parseAmountInput,
} from '#/lib/amount-input'
import { formatCurrency } from '#/lib/currency'

describe('parseAmountInput', () => {
  it.each([
    ['1,234,567.89', '1234567.89'],
    ['৳1,50,000.00', '150000.00'],
    ['$ 1,234.5', '1234.5'],
    ['১,২৩,৪৫৬.৭৮', '123456.78'],
    ['1.2.3', '1.23'],
    ['1234.567', '1234.56'],
    ['007', '7'],
    ['00.5', '0.5'],
    ['0', '0'],
    ['.5', '.5'],
    ['abc', ''],
  ])('%s → %s', (text, raw) => {
    expect(parseAmountInput(text)).toBe(raw)
  })
})

describe('formatAmountInput', () => {
  it('groups the integer part and keeps the fraction as typed', () => {
    expect(formatAmountInput('1234567.89', 'USD', 'en')).toBe('1,234,567.89')
    expect(formatAmountInput('1234.', 'USD', 'en')).toBe('1,234.')
    expect(formatAmountInput('1234.50', 'USD', 'en')).toBe('1,234.50')
    expect(formatAmountInput('.5', 'USD', 'en')).toBe('.5')
    expect(formatAmountInput('', 'USD', 'en')).toBe('')
  })

  it('handles amounts past Number precision', () => {
    expect(formatAmountInput('12345678901234567', 'USD', 'en')).toBe(
      '12,345,678,901,234,567',
    )
  })

  it('groups the way displayed amounts do', () => {
    expect(formatAmountInput('1234567.89', 'BDT', 'en')).toBe(
      formatCurrency('1234567.89', 'BDT').slice(1),
    )
  })

  it('uses Bangla grouping with Latin digits in bn', () => {
    expect(formatAmountInput('1234567.5', 'BDT', 'bn')).toBe('12,34,567.5')
  })
})

describe('applyAmountEdit', () => {
  // `|` marks the caret, before and after the edit.
  function edit(field: string, prevRaw: string, inputType = 'insertText') {
    const caret = field.indexOf('|')
    const r = applyAmountEdit(
      field.slice(0, caret) + field.slice(caret + 1),
      caret,
      prevRaw,
      inputType,
      'USD',
      'en',
    )
    return {
      raw: r.raw,
      field: `${r.display.slice(0, r.caret)}|${r.display.slice(r.caret)}`,
    }
  }

  it('regroups when typing at the end', () => {
    expect(edit('1,2345|', '1234')).toEqual({ raw: '12345', field: '12,345|' })
  })

  it('keeps the caret after the typed digit mid-number', () => {
    expect(edit('129|,345', '12345')).toEqual({
      raw: '129345',
      field: '129|,345',
    })
  })

  it('deletes the digit before a separator on backspace', () => {
    expect(edit('1|234', '1234', 'deleteContentBackward')).toEqual({
      raw: '234',
      field: '|234',
    })
  })

  it('deletes the digit after a separator on forward delete', () => {
    expect(edit('1|234', '1234', 'deleteContentForward')).toEqual({
      raw: '134',
      field: '1|34',
    })
  })

  it('deletes a plain digit normally', () => {
    expect(edit('1,23|', '1234', 'deleteContentBackward')).toEqual({
      raw: '123',
      field: '123|',
    })
  })

  it('cleans a pasted amount', () => {
    expect(edit('৳1,50,000.00|', '', 'insertFromPaste')).toEqual({
      raw: '150000.00',
      field: '150,000.00|',
    })
  })

  it('ignores a third decimal', () => {
    expect(edit('1.256|', '1.25')).toEqual({ raw: '1.25', field: '1.25|' })
  })

  it('ignores a letter without moving the caret', () => {
    expect(edit('1,23a|4', '1234')).toEqual({ raw: '1234', field: '1,23|4' })
  })
})
