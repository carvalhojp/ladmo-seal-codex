export const clampInteger = (value: number, minimum: number, maximum?: number) =>
  Math.min(maximum ?? Number.MAX_SAFE_INTEGER, Math.max(minimum, Math.trunc(Number.isFinite(value) ? value : minimum)))

/** Empty is intentionally an editing state; callers normalize it on blur. */
export const parseNumericDraft = (draft: string, minimum: number, maximum?: number): number | null => {
  if (draft === '') return null
  const value = Number(draft)
  return Number.isFinite(value) ? clampInteger(value, minimum, maximum) : null
}

export const normalizedNumericDraft = (draft: string, minimum: number, maximum?: number) =>
  String(parseNumericDraft(draft, minimum, maximum) ?? minimum)
