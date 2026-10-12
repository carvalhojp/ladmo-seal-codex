import { useEffect, useId, useRef, useState } from 'react'
import type { Lang } from '../App'
import type { Seal } from '../types'
import { localizedSealName } from '../data/localizedSealNames'
import { formatValue, levelFor, maxSealsFor, openersFor, ticketsForSeals, valueFor } from '../utils/calculations'
import { clampInteger } from '../utils/numericInput'
import { getSealState, type SealStateMap, type SealUserState } from '../utils/sealState'

export interface SealProgressEditorProps {
  seal: Seal; destination: number; states: SealStateMap; t: Record<string, string>; lang: Lang
  patchState: (id: string, patch: Partial<SealUserState>) => void
  close: () => void; openCodex: () => void
}

export function SealProgressEditor({ seal, destination, states, t, lang, patchState, close, openCodex }: SealProgressEditorProps) {
  const maximum = maxSealsFor(seal)
  const suggested = clampInteger(destination, 0, maximum)
  const current = getSealState(states, seal.id)
  const [baseline, setBaseline] = useState(() => ({ record: states[seal.id], ...current }))
  const [draft, setDraft] = useState(String(suggested))
  const [review, setReview] = useState(false)
  const dialog = useRef<HTMLElement>(null), input = useRef<HTMLInputElement>(null)
  const id = useId()
  const stale = states[seal.id] !== baseline.record || current.quantity !== baseline.quantity ||
    current.hasSeal !== baseline.hasSeal || current.doNotRecommend !== baseline.doNotRecommend
  const quantity = Number(draft)
  const valid = /^\d+$/.test(draft) && Number.isSafeInteger(quantity) && quantity >= 0 && quantity <= maximum
  const locale = { pt: 'pt-BR', en: 'en-US', es: 'es', ko: 'ko-KR' }[lang]
  const number = (value: number) => value.toLocaleString(locale)
  const bonus = (amount: number) => { const level = levelFor(amount, seal); return level ? valueFor(seal, level.id) : 0 }
  const additional = valid ? Math.max(0, quantity - current.quantity) : null
  const change = valid ? bonus(quantity) - bonus(current.quantity) : 0
  useEffect(() => {
    const previous = document.activeElement
    input.current?.focus()
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  return <div className="modal-back" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
    <section className="modal" ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-help`} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
        if (event.key !== 'Tab') return
        const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')
        if (!items?.length) return
        const first = items[0], last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }}>
      <h2 id={`${id}-title`}>{t.seEditTitle} — {localizedSealName(seal, lang)}</h2>
      <p id={`${id}-help`}>{t.seTotalHelp}</p>
      <dl className="tamer-stats">
        <div><dt>{t.current}</dt><dd>{number(current.quantity)}</dd></div>
        <div><dt>{t.seSuggested}</dt><dd>{number(suggested)}</dd></div>
      </dl>
      {destination !== suggested && <p role="status">{t.seAdjusted} {number(maximum)}</p>}
      <form onSubmit={event => {
        event.preventDefault()
        if (!valid || stale) return
        if (!review) { setReview(true); return }
        patchState(seal.id, { quantity, hasSeal: quantity > 0 || current.hasSeal })
        close()
      }}>
        <div className="own-row"><label htmlFor={`${id}-quantity`}>{t.seTotal}
          <input id={`${id}-quantity`} ref={input} type="text" inputMode="numeric" value={draft}
            aria-invalid={!valid} aria-describedby={!valid ? `${id}-error` : `${id}-help`}
            onChange={event => { setDraft(event.target.value); setReview(false) }}/>
        </label></div>
        {!valid && <p id={`${id}-error`} role="alert">{t.seInvalid} 0–{number(maximum)}.</p>}
        {additional !== null && <>
          <p>{t.seEstimated}: {change < 0 ? `−${formatValue(-change, seal.attribute, locale).slice(1)}` : formatValue(change, seal.attribute, locale)}</p>
          <dl className="tamer-stats">
            <div><dt>{t.newSeals}</dt><dd>{number(additional)}</dd></div>
            <div><dt>{t.ppTickets}</dt><dd>{number(ticketsForSeals(seal, additional))}</dd></div>
            <div><dt>{t.ppOpenersNeeded}</dt><dd>{number(openersFor(additional))}</dd></div>
          </dl><p>{t.seResources}</p>
        </>}
        {stale && <div role="alert"><p>{t.seConflict}</p><button type="button" className="quiet" onClick={() => {
          setBaseline({ record: states[seal.id], ...current }); setDraft(String(current.quantity)); setReview(false)
        }}>{t.seReconcile}</button></div>}
        {review && !stale && <p role="status">{t.seConfirmHelp}: {number(current.quantity)} → {number(quantity)}.</p>}
        <div className="tamer-actions">
          <button type="submit" className="quiet" disabled={!valid || stale}>{review ? t.seConfirm : t.seReview}</button>
          <button type="button" className="quiet" onClick={close}>{t.seCancel}</button>
          <button type="button" className="quiet" onClick={openCodex}>{t.seOpenCodex}</button>
        </div>
      </form>
    </section>
  </div>
}
