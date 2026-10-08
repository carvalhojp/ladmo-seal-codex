import { useState } from 'react'
import { equipmentProgressCatalog, mdgProgressCatalog, loaderStages, type EquipmentLanguage, type EquipmentProgressItem } from '../data/equipmentProgressCatalog'
import { summarizeEquipmentProgress, updateEquipmentProgress, type EquipmentProgressState } from '../utils/equipmentState'

export function EquipmentProgress({ state, blocked, save, t, lang }: {
  state: EquipmentProgressState; blocked: boolean; save: (state: EquipmentProgressState) => void; t: Record<string, string>; lang: EquipmentLanguage;
}) {
  const [message, setMessage] = useState('')
  const summary = summarizeEquipmentProgress(state)
  const change = (id: string, owned: boolean, stageId?: string) => {
    try { save(updateEquipmentProgress(state, id, owned, stageId)); setMessage(t.epSaved) }
    catch { setMessage(t.epError) }
  }
  const card = (item: EquipmentProgressItem) => {
    const entry = state.items[item.id]
    return <article className="equipment-progress-card" key={item.id}>
      <h3>{item.names[lang]}</h3>
      <label><input type="checkbox" checked={Boolean(entry)} disabled={blocked} onChange={event => change(item.id, event.target.checked)} />{t.epOwned}</label>
      {item.kind === 'loader' && entry && <label className="equipment-stage">{t.epStage}<select disabled={blocked} value={entry.stageId ?? ''} onChange={event => change(item.id, true, event.target.value || undefined)}>
        <option value="">{t.epUnknownStage}</option>{loaderStages.map(stage => <option key={stage.id} value={stage.id}>{stage.level === 11 ? t.epComplete : `${t.epLevel} ${stage.level}`}</option>)}
      </select></label>}
    </article>
  }
  return <section className="equipment-progress" aria-label={t.epTitle}>
    <div className="tamer-panel"><h2>{t.epTitle}</h2><p>{t.epIntro}</p><p>{t.epExcluded}</p>
      {blocked && <p role="alert">{t.epBlocked}</p>}
      <p>{t.epItems}: <strong>{summary.equipment}</strong> · {t.epPieces}: <strong>{summary.mdgPieces}</strong></p>
      {message && <p role="status">{message}</p>}
    </div>
    <div className="equipment-progress-grid">{equipmentProgressCatalog.map(card)}</div>
    <h2>{t.epMdg}</h2><div className="equipment-progress-grid">{mdgProgressCatalog.map(card)}</div>
  </section>
}
