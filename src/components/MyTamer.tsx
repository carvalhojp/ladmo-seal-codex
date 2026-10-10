import { useMemo } from 'react'
import { TamerGoals, type TamerGoalsProps } from './TamerGoals'
import { PageHead } from './PageHead'
import { summarizeMyTamer } from '../utils/myTamer'
import { formatValue } from '../utils/calculations'
import { localizedSealName } from '../data/localizedSealNames'
import type { SealStateMap } from '../utils/sealState'
import type { DUnitInventory, DUnitProgress } from '../utils/dUnit'
import type { Attribute } from '../types'
import type { Lang } from '../App'
import { emptyEquipmentProgress, summarizeEquipmentProgress, type EquipmentProgressState } from '../utils/equipmentState'
import { equipmentProgressCatalog, mdgProgressCatalog, loaderStages } from '../data/equipmentProgressCatalog'

const attributes: Attribute[] = ['AT', 'HT', 'CT', 'HP', 'DS', 'DE', 'BL', 'EV']
export type TamerDestination = 'codex' | 'dunit' | 'mySeals' | 'myDUnit' | 'goal' | 'equipment' | 'equipmentProgress'

export function MyTamer({ t, lang, sealStates, progress, inventory, navigate, goalsProps, equipment = emptyEquipmentProgress(), equipmentBlocked = false }: {
  equipment?: EquipmentProgressState; equipmentBlocked?: boolean;
  t: Record<string, string>; lang: Lang; sealStates: SealStateMap; progress: DUnitProgress;
  inventory?: DUnitInventory;
  goalsProps?: Pick<TamerGoalsProps,'state'|'blocked'|'save'|'plan'|'viewSet'>;
  navigate: (destination: TamerDestination) => void;
}) {
  const summary = useMemo(() => summarizeMyTamer(sealStates, progress), [sealStates, progress])
  const equipmentSummary = useMemo(() => summarizeEquipmentProgress(equipment), [equipment])
  const loaderStage = loaderStages.find(stage => stage.id === equipmentSummary.loaderStage)
  const locale = { pt: 'pt-BR', en: 'en-US', es: 'es', ko: 'ko-KR' }[lang]
  const number = (value: number) => value.toLocaleString(locale)
  const percent = (value: number, total: number) => (total ? value / total : 0).toLocaleString(locale, { style: 'percent', maximumFractionDigits: 1 })
  return <>
    <PageHead eyebrow="LADMO CODEX" title={t.myTamer} text={t.tamerIntro}/>
    <div className="tamer-actions"><button className="quiet" onClick={() => navigate('goal')}>{t.ppTamerCTA}</button></div>
    <div className="tamer-page">
      <section className="tamer-panel tamer-overview-intro" aria-labelledby="tamer-recorded"><h2 id="tamer-recorded">{t.tamerSystemsTitle}</h2><p>{t.tamerNotice}</p></section>
        <div className="tamer-overview-grid">
          <section className="tamer-panel" aria-labelledby="tamer-seals"><h2 id="tamer-seals">Seal Master</h2>
            <dl className="tamer-stats"><div><dt>{t.tamerOwned}</dt><dd>{number(summary.seals.owned)} <small>/ {number(summary.seals.total)}</small></dd></div><div><dt>{t.tamerMaster}</dt><dd>{number(summary.seals.master)}</dd></div></dl>
            {summary.seals.owned > 0 ? <><p>{t.tamerCollection}: <strong>{percent(summary.seals.owned,summary.seals.total)}</strong></p><details className="tamer-details"><summary>{t.tamerCurrentBonuses}</summary><dl className="tamer-bonuses">{attributes.map(attribute => <div key={attribute}><dt><span className={'attr ' + attribute}>{attribute}</span></dt><dd>{formatValue(summary.seals.bonuses[attribute], attribute, locale)}</dd></div>)}</dl></details><button className="quiet" onClick={() => navigate('mySeals')}>{t.tamerViewSeals}</button></>
              : <p>{t.tamerEmptySeals}</p>}
            <button className="quiet" onClick={() => navigate('codex')}>{t.tamerRegisterSeals}</button>
          </section>
          <section className="tamer-panel" aria-labelledby="tamer-dunit"><h2 id="tamer-dunit">D-Unit</h2>
            <dl className="tamer-stats"><div><dt>{t.tamerSetsRecorded}</dt><dd>{number(summary.dUnit.completeSets+summary.dUnit.startedSets)} <small>/ {number(summary.dUnit.totalSets)}</small></dd></div><div><dt>{t.tamerConditions}</dt><dd>{number(summary.dUnit.completed)} <small>/ {number(summary.dUnit.totalConditions)}</small></dd></div></dl>
            {summary.dUnit.completed > 0 ? <><p>{t.tamerComplete}: <strong>{number(summary.dUnit.completeSets)}</strong> · {t.tamerStarted}: <strong>{number(summary.dUnit.startedSets)}</strong></p><details className="tamer-details"><summary>{t.tamerEarnedBonuses}</summary><dl className="tamer-bonuses">{Object.entries(summary.dUnit.bonuses).map(([key, value]) => { const [attribute, qualifier, unit] = key.split('|'); return <div key={key}><dt>{[attribute, qualifier].filter(Boolean).join(' ')}</dt><dd>+{number(value)}{unit === 'percent' ? '%' : ''}</dd></div> })}</dl></details><button className="quiet" onClick={() => navigate('myDUnit')}>{t.tamerViewDUnit}</button></>
              : <p>{t.tamerEmptyDUnit}</p>}
            <button className="quiet" onClick={() => navigate('dunit')}>{t.tamerRegisterDUnit}</button>
          </section>
          <section className="tamer-panel" aria-labelledby="tamer-equipment"><h2 id="tamer-equipment">{t.equipmentTitle}</h2>
            {equipmentBlocked ? <p role="alert">{t.epBlocked}</p> : <>
              <dl className="tamer-stats"><div><dt>{t.epItems}</dt><dd>{number(equipmentSummary.equipment)} <small>/ {equipmentProgressCatalog.length}</small></dd></div><div><dt>{t.epPieces}</dt><dd>{number(equipmentSummary.mdgPieces)} <small>/ {mdgProgressCatalog.length}</small></dd></div></dl>
              {!equipmentSummary.equipment && !equipmentSummary.mdgPieces && <p>{t.epEmpty}</p>}
              <p>{t.epStage}: <strong>{!equipment.items['susanoomon-loader'] ? t.tamerLoaderNotRecorded : loaderStage ? loaderStage.level === 11 ? t.epComplete : `${t.epLevel} ${loaderStage.level}` : t.epUnknownStage}</strong></p>
              <p>{t.tamerEquipmentHint}</p>
            </>}
            <button className="quiet" onClick={() => navigate('equipmentProgress')}>{t.tamerViewEquipmentProgress}</button>
          </section>
          <section className="tamer-panel" aria-labelledby="tamer-goals-summary"><h2 id="tamer-goals-summary">{t.tgTitle}</h2>
            {goalsProps?.blocked ? <p role="alert">{t.tgBlocked}</p> : <><dl className="tamer-stats"><div><dt>{t.tamerGoalsCount}</dt><dd>{number(goalsProps?.state.goals.length??0)}</dd></div></dl><p>{goalsProps?.state.goals.length ? t.tgRecorded : t.tgEmpty}</p></>}
            {goalsProps && <details className="tamer-details"><summary>{t.tamerManageGoals}</summary><TamerGoals {...goalsProps} t={t} lang={lang} sealStates={sealStates} progress={progress} inventory={inventory}/></details>}
          </section>
        </div>
      {summary.hasProgress && <>
        <section className="tamer-panel" aria-labelledby="tamer-next"><h2 id="tamer-next">{t.tamerNext}</h2><div className="tamer-columns">
          <div><h3>{t.tamerNextSeal}</h3><p>{t.tamerSealCriterion}</p>{summary.seals.next.length ? <ul className="tamer-next-list">{summary.seals.next.map(item => <li key={item.seal.id}><b>{localizedSealName(item.seal, lang)}</b><span>{item.current?.label ?? t.tamerNoStage} → {item.next.label}</span><span>{t.tamerMissing}: <strong>{number(item.remaining)}</strong></span><span>{t.tamerGain}: <strong>{item.seal.attribute} {formatValue(item.gain, item.seal.attribute, locale)}</strong></span></li>)}</ul> : <p>{t.tamerNoNextSeals}</p>}</div>
          <div><h3>{t.tamerNextSet}</h3><p>{t.tamerSetCriterion}</p>{summary.dUnit.next.length ? <ul className="tamer-next-list">{summary.dUnit.next.map(item => <li key={item.set.id}><b>{item.set.name}</b><span>{item.condition.requirement}</span><strong>{item.condition.bonus.rawLabel}</strong></li>)}</ul> : <p>{t.tamerNoNextSets}</p>}</div>
        </div></section>
      </>}
    </div>
  </>
}
