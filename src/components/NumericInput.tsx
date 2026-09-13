import { useEffect, useState } from 'react'
import { normalizedNumericDraft, parseNumericDraft } from '../utils/numericInput'

export function NumericInput({ value, onValue, min = 0, max }: { value: number; onValue: (value: number) => void; min?: number; max?: number }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return <input type="number" min={min} max={max} value={draft} onChange={event => {
    const next = event.target.value
    setDraft(next)
    const parsed = parseNumericDraft(next, min, max)
    if (parsed !== null) { onValue(parsed); setDraft(String(parsed)) }
  }} onBlur={() => { const next = normalizedNumericDraft(draft, min, max); setDraft(next); onValue(Number(next)) }} />
}
