import { describe, expect, it } from 'vitest'
import { clampInteger, normalizedNumericDraft, parseNumericDraft } from './numericInput'

describe('numeric input drafts', () => {
  it('keeps an erased field empty while editing', () => expect(parseNumericDraft('', 0)).toBeNull())
  it('accepts a replacement value without preserving a leading zero', () => expect(normalizedNumericDraft('0100', 0)).toBe('100'))
  it('normalizes an empty field on blur', () => expect(normalizedNumericDraft('', 0)).toBe('0'))
  it('never returns NaN', () => expect(parseNumericDraft('not-a-number', 0)).toBeNull())
  it('keeps existing integer limits for seal quantities', () => {
    expect(clampInteger(-2, 0, 700)).toBe(0)
    expect(clampInteger(999, 0, 700)).toBe(700)
  })
})
