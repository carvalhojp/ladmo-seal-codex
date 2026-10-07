import { useMemo } from 'react'
import { TamerGoals, type TamerGoalsProps } from './TamerGoals'
import { PageHead } from './PageHead'
import { summarizeMyTamer } from '../utils/myTamer'
import { formatValue } from '../utils/calculations'
import { localizedSealName } from '../data/localizedSealNames'
import type { SealStateMap } from '../utils/sealState'
import type { DUnitProgress } from '../utils/dUnit'
import type { Attribute } from '../types'
import type { Lang } from '../App'

const attributes: Attribute[] = ['AT', 'HT', 'CT', 'HP', 'DS', 'DE', 'BL', 'EV']
export type TamerDestination = 'codex' | 'dunit' | 'mySeals' | 'myDUnit' | 'goal'

export function MyTamer({ t, lang, sealStates, progress, navigate, goalsProps }: {
  t: Record<string, string>; lang: Lang; sealStates: SealStateMap; progress: DUnitProgress;
  goalsProps?: Pick<TamerGoalsProps,'state'|'blocked'|'save'|'plan'|'viewSet'>;
  navigate: (destination: TamerDestination) => void;
}) {
  const summary = useMemo(() => summarizeMyTamer(sealStates, progress), [sealStates, progress])
  const locale = { pt: 'pt-BR', en: 'en-US', es: 'es', ko: 'ko-KR' }[lang]
  const number = (value: number) => value.toLocaleString(locale)
  const percent = (value: number, total: number) => (total ? value / total : 0).toLocaleString(locale, { style: 'percent', maximumFractionDigits: 1 })
  const actions = <div className="tamer-actions"><button className="quiet" onClick={() => navigate('codex')}>{t.tamerRegisterSeals}</button><button className="quiet" onClick={() => navigate('dunit')}>{t.tamerRegisterDUnit}</button></div>
  return <>
    <PageHead eyebrow="LADMO CODEX" title={t.myTamer} text={t.tamerIntro}/>
    <div className="tamer-actions"><button className="quiet" onClick={() => navigate('goal')}>{t.ppTamerCTA}</button></div>
    <div className="tamer-page">
      {goalsProps && <TamerGoals {...goalsProps} t={t} lang={lang} sealStates={sealStates} progress={progress}/>}
      <section className="tamer-panel" aria-labelledby="tamer-recorded"><h2 id="tamer-recorded">{t.tamerRecorded}</h2><p>{t.tamerNotice}</p>
        {summary.hasProgress ? <dl className="tamer-stats"><div><dt>{t.tamerOwned}</dt><dd>{number(summary.seals.owned)} <small>/ {number(summary.seals.total)}</small></dd><small>{t.tamerCollection}: {percent(summary.seals.owned, summary.seals.total)}</small></div><div><dt>{t.tamerConditions}</dt><dd>{number(summary.dUnit.completed)} <small>/ {number(summary.dUnit.totalConditions)}</small></dd><small>{percent(summary.dUnit.completed, summary.dUnit.totalConditions)}</small></div></dl>
          : <div className="tamer-empty"><h3>{t.tamerEmpty}</h3><p>{t.tamerEmptyHint}</p>{actions}</div>}
      </section>
      {summary.hasProgress && <>
        <div className="tamer-columns">
          <section className="tamer-panel" aria-labelledby="tamer-seals"><h2 id="tamer-seals">Seal Master</h2>
            {summary.seals.owned > 0 ? <><p>{t.tamerMaster}: <strong>{number(summary.seals.master)}</strong></p><h3>{t.tamerCurrentBonuses}</h3><dl className="tamer-bonuses">{attributes.map(attribute => <div key={attribute}><dt><span className={'attr ' + attribute}>{attribute}</span></dt><dd>{formatValue(summary.seals.bonuses[attribute], attribute, locale)}</dd></div>)}</dl><button className="quiet" onClick={() => navigate('mySeals')}>{t.tamerViewSeals}</button></>
              : <><p>{t.tamerEmptySeals}</p><button className="quiet" onClick={() => navigate('codex')}>{t.tamerRegisterSeals}</button></>}
          </section>
          <section className="tamer-panel" aria-labelledby="tamer-dunit"><h2 id="tamer-dunit">D-Unit</h2>
            {summary.dUnit.completed > 0 ? <><dl className="tamer-stats"><div><dt>{t.tamerComplete}</dt><dd>{number(summary.dUnit.completeSets)} <small>/ {number(summary.dUnit.totalSets)}</small></dd></div><div><dt>{t.tamerStarted}</dt><dd>{number(summary.dUnit.startedSets)}</dd></div></dl><details className="tamer-details"><summary>{t.tamerEarnedBonuses}</summary><dl className="tamer-bonuses">{Object.entries(summary.dUnit.bonuses).map(([key, value]) => { const [attribute, qualifier, unit] = key.split('|'); return <div key={key}><dt>{[attribute, qualifier].filter(Boolean).join(' ')}</dt><dd>+{number(value)}{unit === 'percent' ? '%' : ''}</dd></div> })}</dl></details><button className="quiet" onClick={() => navigate('myDUnit')}>{t.tamerViewDUnit}</button></>
              : <><p>{t.tamerEmptyDUnit}</p><button className="quiet" onClick={() => navigate('dunit')}>{t.tamerRegisterDUnit}</button></>}
          </section>
        </div>
        <section className="tamer-panel" aria-labelledby="tamer-next"><h2 id="tamer-next">{t.tamerNext}</h2><div className="tamer-columns">
          <div><h3>{t.tamerNextSeal}</h3><p>{t.tamerSealCriterion}</p>{summary.seals.next.length ? <ul className="tamer-next-list">{summary.seals.next.map(item => <li key={item.seal.id}><b>{localizedSealName(item.seal, lang)}</b><span>{item.current?.label ?? t.tamerNoStage} → {item.next.label}</span><span>{t.tamerMissing}: <strong>{number(item.remaining)}</strong></span><span>{t.tamerGain}: <strong>{item.seal.attribute} {formatValue(item.gain, item.seal.attribute, locale)}</strong></span></li>)}</ul> : <p>{t.tamerNoNextSeals}</p>}</div>
          <div><h3>{t.tamerNextSet}</h3><p>{t.tamerSetCriterion}</p>{summary.dUnit.next.length ? <ul className="tamer-next-list">{summary.dUnit.next.map(item => <li key={item.set.id}><b>{item.set.name}</b><span>{item.condition.requirement}</span><strong>{item.condition.bonus.rawLabel}</strong></li>)}</ul> : <p>{t.tamerNoNextSets}</p>}</div>
        </div></section>
      </>}
    </div>
  </>
}
