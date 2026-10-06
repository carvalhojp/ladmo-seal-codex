import { useMemo, useRef, useState } from 'react'
import { dUnitSets, type DUnitCondition } from '../data/dUnitAudit'
import { dUnitPortraitIdentityAudit, identitiesForDUnitSet } from '../data/dUnitPortraitIdentityAudit'
import { bonusKey, calculateDUnitGoalRoute, isDUnitConditionCompleted, type DUnitBonusKey, type DUnitProgress } from '../utils/dUnit'
import type { DUnitCandidateRoute, DUnitPlayerState } from '../utils/dUnitCostBenefit'
import { aggregateDUnitBonuses } from '../utils/dUnit'
import { parseProgressionTarget, progressionDUnitOptions, progressionObjectiveLabelKey, progressionSubtypeLabelKey, progressionText, progressionUnit, type ProgressionObjective } from '../utils/progressionPlanner'
import type { Lang } from '../App'
import { DUnitPortraitList } from './DUnitPortraitList'
import { compareDUnitRouteWork, describeDUnitRouteWork } from '../utils/dUnitRouteWork'
import { dUnitPortraitProgressionAudit } from '../data/dUnitPortraitProgressionAudit'

export const isDUnitRouteRecommendationCompleted = (progress: DUnitProgress, condition: DUnitCondition) => isDUnitConditionCompleted(progress, condition)
type RouteRecommendation = ReturnType<typeof calculateDUnitGoalRoute>['recommendations'][number]
type RouteLike = Pick<DUnitCandidateRoute, 'totalGain' | 'recommendations' | 'setCount' | 'unverifiedSetIds'>

export const groupDUnitRouteRecommendations = (recommendations: RouteRecommendation[]) =>
  [...recommendations.reduce((groups, item) => {
    const group = groups.get(item.setId) ?? { setId: item.setId, items: [] as RouteRecommendation[] }
    group.items.push(item); groups.set(item.setId, group); return groups
  }, new Map<string, { setId: string; items: RouteRecommendation[] }>()).values()]

export const dUnitRouteSignature = (route: RouteLike) => route.recommendations.map(item => item.condition.id).sort().join('|')
export const DUNIT_ROUTE_PAGE_SIZE = 24
const routeNames = (route: RouteLike) => groupDUnitRouteRecommendations(route.recommendations).map(group => dUnitSets.find(set => set.id === group.setId)?.name ?? group.setId)
const routeState = (route: RouteLike) => route.unverifiedSetIds.length === 0 ? 'validated' : route.unverifiedSetIds.length < route.setCount ? 'partial' : 'pending'
const requirementKind = (requirement: string) => /transcendid/i.test(requirement) ? 'transcendence' : /nível|nivel/i.test(requirement) ? 'level' : /obtido/i.test(requirement) ? 'obtained' : 'unknown'

export const routeTaskSummary = (route: RouteLike, progress: DUnitProgress) => {
  const pending = route.recommendations.filter(item => !isDUnitRouteRecommendationCompleted(progress, item.condition))
  return pending.reduce((summary, item) => {
    const kind = requirementKind(item.condition.requirement)
    summary[kind]++
    return summary
  }, { obtained: 0, level: 0, transcendence: 0, unknown: 0 })
}

export const filterDUnitCandidateRoutes = (snapshot: ReturnType<typeof calculateDUnitGoalRoute>, query: string) => {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const source = [snapshot as RouteLike, ...snapshot.alternatives, ...snapshot.candidateAlternatives]
  const unique = new Map<string, RouteLike>()
  source.forEach(route => unique.set(dUnitRouteSignature(route), route))
  const all = [...unique.values()]
  if (!terms.length) return all
  return all.filter(route => {
    const names = routeNames(route).join(' ').toLocaleLowerCase()
    return terms.every(term => names.includes(term))
  })
}

const taskLabel = (t: any, summary: ReturnType<typeof routeTaskSummary>) => [
  summary.obtained && `${summary.obtained} ${t.dunitTasksObtained}`,
  summary.level && `${summary.level} ${t.dunitTasksLevel}`,
  summary.transcendence && `${summary.transcendence} ${t.dunitTasksTranscendence}`,
  summary.unknown && `${summary.unknown} ${t.dunitTasksOther}`,
].filter(Boolean).join(' · ')

function RouteCard({ route, index, progress, snapshotProgress, playerState, selected, onSelect, onComplete, t, selectedLabel, currentBonus }: { route: RouteLike; index: number; progress: DUnitProgress; snapshotProgress:DUnitProgress; playerState: DUnitPlayerState; selected: boolean; onSelect: () => void; onComplete: (setId: string, conditionId: string) => void; t: any; selectedLabel: string; currentBonus: number }) {
  const [expanded, setExpanded] = useState(false)
  const groups = groupDUnitRouteRecommendations(route.recommendations)
  const state = routeState(route), tasks = routeTaskSummary(route, snapshotProgress)
  const status = state === 'validated' ? t.dunitCostValidated : state === 'partial' ? t.dunitCostPartial : t.dunitCostUnverified
  return <article className="dunit-route-card">
    <div className="dunit-route-card-top"><div><span className="eyebrow">{t.dunitRouteCandidate}</span><b>{routeNames(route).join(' · ')}</b></div><label className="dunit-compare-select"><input type="checkbox" checked={selected} onChange={onSelect}/>{t.dunitCompareSelect}</label></div>
    <div className="dunit-route-preview">{groups.map(group => { const set = dUnitSets.find(item => item.id === group.setId)!; return <section key={group.setId}><b>{set.name}</b><DUnitPortraitList setId={group.setId} altPrefix={t.dunitPortraitAlt} decorative/></section> })}</div>
    <div className="dunit-route-facts"><span>{t.dunitRouteGain}: +{route.totalGain} {selectedLabel}</span><span>{t.dunitProjectedTotal}: +{currentBonus + route.totalGain} {selectedLabel}</span><span>{t.dunitRouteSets}: {route.setCount}</span><span>{taskLabel(t, tasks) || t.dunitTasksUnavailable}</span><span className={`dunit-comparison-${state}`}>{status}</span></div>
    {state !== 'validated' && <p className="dunit-route-notice">{state === 'partial' ? t.dunitPartialNotice : t.dunitRequirementsOnly}</p>}
    <button className="dunit-candidate-toggle" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}><span>{expanded ? t.dunitHideConditions : t.dunitShowConditions}</span><span>{expanded ? '−' : '+'}</span></button>
    {expanded && <div className="dunit-candidate-details">{groups.map(group => { const set = dUnitSets.find(item => item.id === group.setId)!; return <section key={group.setId}><b>{set.name}</b><small className="dunit-progression-heading">{t.dunitRequiredConditions}</small>{group.items.map(item => { const completed=isDUnitRouteRecommendationCompleted(progress,item.condition), work=describeDUnitRouteWork(item.setId,item.condition,playerState); return <div className="dunit-candidate-step dunit-candidate-condition" key={item.condition.id}><span>{completed ? `✓ ${t.dunitDone} — ` : ''}{item.condition.requirement} · {item.condition.bonus.rawLabel}<small>{routeConditionDetail(work,t)}</small></span><button className="quiet recommendation-add" disabled={completed} onClick={()=>onComplete(item.setId,item.condition.id)}>{completed?`✓ ${t.dunitDone}`:t.dunitMarkDone}</button></div> })}</section> })}</div>}
  </article>
}

const unique=(values:readonly string[])=>[...new Set(values)]
const setName=(setId:string)=>dUnitSets.find(set=>set.id===setId)?.name??setId
const auditedName=(digimonId:string)=>{
  const identity=dUnitPortraitIdentityAudit.find(item=>item.digimonId===digimonId)
  if(!identity)return digimonId
  const canonical=identity.canonicalName??digimonId
  const variant=identity.variant
  return `${canonical}${variant?` [${variant}]`:''}`
}
export const dUnitRouteOverview=(route:RouteLike,playerState:DUnitPlayerState)=>{
  const setIds=unique(route.recommendations.map(item=>item.setId))
  const audits=dUnitPortraitProgressionAudit.filter(item=>setIds.includes(item.setId))
  const work=route.recommendations.map(item=>describeDUnitRouteWork(item.setId,item.condition,playerState))
  const bases=audits.filter(item=>item.relationship==='base')
  const confirmedLines=unique(bases.filter(item=>item.evolutionStatus==='confirmed'&&item.evolutionLineId).map(item=>auditedName(item.digimonId)))
  const baseNames=bases.map(item=>auditedName(item.digimonId))
  const missingBases=bases.filter(item=>!playerState.ownedDigimonIds?.includes(item.digimonId)).map(item=>auditedName(item.digimonId))
  const historicalObtainment=bases.filter(item=>item.obtainmentMethod).map(item=>`${auditedName(item.digimonId)}: ${item.obtainmentMethod}`)
  const unlocks=audits.filter(item=>item.unlockStatus==='confirmed'&&item.unlockRequirement).map(item=>`${auditedName(item.digimonId)}: ${item.unlockRequirement}`)
  const levels=work.filter(item=>item.kind==='level'&&item.completeIdentity).map(item=>`${setName(item.setId)}: ${item.levelCurrent??0}/${item.condition.requirement.match(/\d+/)?.[0]??0} · ${item.levelRemaining??0}`)
  const transcendence=unique(work.filter(item=>item.kind==='transcendence').flatMap(item=>item.missingTranscendenceNames))
  const identitiesKnown=(kind?:ReturnType<typeof requirementKind>)=>work.filter(item=>!kind||item.kind===kind).every(item=>item.completeIdentity)
  return { work, owned:unique(work.flatMap(item=>item.ownedNames)), bases:unique(baseNames), confirmedLines, missingBases:unique(missingBases), evolutions:unique(work.flatMap(item=>item.missingEvolution)), levels, transcendence, historicalObtainment:unique(historicalObtainment), unlocks:unique(unlocks), determinability:{bases:identitiesKnown(),evolutions:identitiesKnown(),levels:identitiesKnown('level'),transcendence:identitiesKnown('transcendence')} }
}
export const dUnitComparisonMetricText=(known:boolean,value:number,unknownLabel:string)=>known?String(value):unknownLabel
const routeConditionDetail=(item:ReturnType<typeof describeDUnitRouteWork>,t:any)=>{
  if(!item.completeIdentity) return t.dunitIdentityPending
  if(item.kind==='obtained') return `${t.missing}: ${item.missingOwnedNames.length ? item.missingOwnedNames.join(', ') : '0'}`
  if(item.kind==='level') return `${t.dunitTasksLevel}: ${item.levelCurrent ?? 0}/${item.condition.requirement.match(/\d+/)?.[0] ?? 0} · ${t.missing}: ${item.levelRemaining ?? 0}`
  if(item.kind==='transcendence') return `${t.missing}: ${item.missingTranscendenceNames.length ? item.missingTranscendenceNames.join(', ') : '0'}`
  return item.memberNames.join(', ')
}

function RouteComparison({ routes, t, selectedLabel, progress, playerState, onRemove, onClear }: { routes: RouteLike[]; t: any; selectedLabel: string; progress: DUnitProgress; playerState:DUnitPlayerState; onRemove: (route: RouteLike) => void; onClear: () => void }) {
  const [copied,setCopied]=useState(false)
  if (routes.length < 2) return null
  const work=routes.map(route=>route.recommendations.map(item=>describeDUnitRouteWork(item.setId,item.condition,playerState)))
  const comparisons=work.slice(1).map(candidate=>compareDUnitRouteWork(work[0]!,candidate))
  const shared=unique(comparisons.flatMap(item=>item.remainingShared))
  const similar=[...new Set(comparisons.flatMap(item=>item.similarButDifferent))]
  const unknown=[...new Set(comparisons.flatMap(item=>item.unknownSharing))]
  const copyComparison=async()=>{
    const text=[t.dunitCompareTitle,...routes.map((route,index)=>{const overview=dUnitRouteOverview(route,playerState), routeWork=overview.work; return [`${index+1}. ${routeNames(route).join(' · ')}`,`${t.dunitRouteGain}: +${route.totalGain} ${selectedLabel}`,`${t.dunitMissingBases}: ${dUnitComparisonMetricText(overview.determinability.bases,overview.missingBases.length,t.dunitNotIdentified)}`,`${t.dunitIndividualEvolutions}: ${dUnitComparisonMetricText(overview.determinability.evolutions,overview.evolutions.length,t.dunitNotIdentified)}`,`${t.dunitPendingLevelConditions}: ${dUnitComparisonMetricText(overview.determinability.levels,routeWork.filter(item=>item.kind==='level'&&item.completeIdentity).length,t.dunitNotIdentified)}`,`${t.dunitPendingTranscendenceConditions}: ${dUnitComparisonMetricText(overview.determinability.transcendence,routeWork.filter(item=>item.kind==='transcendence'&&item.completeIdentity).length,t.dunitNotIdentified)}`,routeState(route)==='validated'?t.dunitCostValidated:routeState(route)==='partial'?t.dunitCostPartial:t.dunitCostUnverified].join('\n')}),`${t.dunitSharedRequirements}: ${shared.length} ${t.dunitSharedPendingForms}`].join('\n\n')
    await navigator.clipboard.writeText(text); setCopied(true)
  }
  return <section className="dunit-route-comparison"><div className="dunit-comparison-heading"><div><span className="eyebrow">{t.dunitCompareTitle}</span><h2>{t.dunitCompareHeading}</h2></div><div className="dunit-comparison-actions"><button className="quiet" onClick={copyComparison}>{copied?t.dunitComparisonCopied:t.dunitCopyComparison}</button><button className="quiet" onClick={onClear}>{t.dunitClearComparison}</button></div></div><p>{t.dunitCompareDescription}</p><div className="dunit-compare-grid">{routes.map((route, index) => {
    const routeOverview=dUnitRouteOverview(route,playerState)
    const routeWork=routeOverview.work
    const overview:any={...routeOverview,missingBases:routeOverview.determinability.bases?routeOverview.missingBases:{length:t.dunitNotIdentified},evolutions:routeOverview.determinability.evolutions?routeOverview.evolutions:{length:t.dunitNotIdentified}}
    const state = routeState(route)
    const exclusive=index===0 ? unique(comparisons.flatMap(item=>item.remainingOnlyLeft)) : comparisons[index-1]?.remainingOnlyRight ?? []
    const levelCount=overview.determinability.levels?routeWork.filter(item=>item.kind==='level'&&item.completeIdentity).length:t.dunitNotIdentified
    const transcendenceCount=overview.determinability.transcendence?routeWork.filter(item=>item.kind==='transcendence'&&item.completeIdentity).length:t.dunitNotIdentified
    return <article key={dUnitRouteSignature(route)}><div className="dunit-comparison-route-heading"><b>{t.dunitRouteCandidate}</b><button className="quiet" onClick={()=>onRemove(route)}>{t.dunitRemoveComparison}</button></div><small>{routeNames(route).join(' · ')}</small><div className="dunit-route-summary"><span>{t.dunitRouteGain}: +{route.totalGain} {selectedLabel}</span><span>{t.dunitRouteSets}: {route.setCount}</span><span>{t.dunitMissingBases}: {overview.missingBases.length}</span><span>{t.dunitIndividualEvolutions}: {overview.evolutions.length}</span><span>{t.dunitPendingLevelConditions}: {levelCount}</span><span>{t.dunitPendingTranscendenceConditions}: {transcendenceCount}</span><span className={`dunit-comparison-${state}`}>{state === 'validated' ? t.dunitCostValidated : state === 'partial' ? t.dunitCostPartial : t.dunitCostUnverified}</span></div><details className="dunit-route-details"><summary>{t.dunitRouteDetails}</summary><div className="dunit-candidate-details">{overview.owned.length>0&&<small><b>{t.dunitInventoryCredit}</b><br/>{overview.owned.join(', ')}</small>}{overview.missingBases.length>0&&<small><b>{t.dunitMissingBases}</b><br/>{overview.missingBases.join(', ')}</small>}{overview.confirmedLines.length>0&&<small><b>{t.dunitConfirmedLines}</b><br/>{overview.confirmedLines.join(', ')}</small>}{overview.evolutions.length>0&&<small><b>{t.dunitIndividualEvolutions}</b><br/>{overview.evolutions.join(', ')}</small>}{overview.levels.length>0&&<small><b>{t.dunitPendingLevels}</b><br/>{overview.levels.join(' · ')}</small>}{overview.transcendence.length>0&&<small><b>{t.dunitPendingTranscendence}</b><br/>{overview.transcendence.join(', ')}</small>}{exclusive.length>0&&<small><b>{t.dunitRemainingExclusive}</b><br/>{exclusive.join(', ')}</small>}{overview.historicalObtainment.length>0&&<small><b>{t.dunitHistoricalObtainment}</b><br/>{overview.historicalObtainment.join(' · ')}</small>}{overview.unlocks.length>0&&<small><b>{t.dunitKnownUnlocks}</b><br/>{overview.unlocks.join(', ')}</small>}{routeWork.map(item=><small key={item.condition.id}><b>{isDUnitRouteRecommendationCompleted(progress,item.condition)?`✓ ${t.dunitDone} — `:''}{setName(item.setId)} — {item.condition.requirement}</b><br/>{routeConditionDetail(item,t)}</small>)}</div></details></article>
  })}</div><div className="dunit-shared-requirements">{shared.length>0?<p>{t.dunitSharedRequirements}: {shared.length}</p>:<p>{t.dunitSharedUnavailable}</p>}{(shared.length>0||similar.length>0||unknown.length>0)&&<details className="dunit-route-details"><summary>{t.dunitSharedDetails}</summary><div className="dunit-candidate-details">{shared.length>0&&<small><b>{t.dunitSharedRequirements}</b><br/>{shared.join(' · ')}</small>}{similar.length>0&&<small><b>{t.dunitSimilarRequirements}</b><br/>{similar.join(' · ')}</small>}{unknown.length>0&&<small><b>{t.dunitSharedUnavailable}</b><br/>{unknown.join(' · ')}</small>}</div></details>}</div><p className="dunit-route-notice">{t.dunitComparisonLimits}</p></section>
}

export function DUnitGoalPlanner({ t:copy,lang,objective,progress,toggle,playerState,go }: {t:Record<string,string>;lang:Lang;objective:ProgressionObjective;progress:DUnitProgress;toggle:(setId:string,conditionId:string,checked:boolean)=>void;playerState:DUnitPlayerState;go:()=>void}) {
  const t:Record<string,string>={...copy,dunitDone:copy.ppStepDone,dunitMarkDone:copy.ppMarkDone,dunitSearchNoCandidates:copy.ppNoSearch,dunitProjectedTotal:copy.ppProjected,dunitIdentityPending:copy.ppIdentity}
  const options = useMemo(() => progressionDUnitOptions(objective), [objective])
  const [selectedKey,setSelectedKey]=useState<DUnitBonusKey|''>('')
  const key=objective==='Dano habilidade'?selectedKey:(options[0]?.key??'')
  const [draft,setDraft]=useState('')
  type Snapshot=ReturnType<typeof calculateDUnitGoalRoute>&{source:DUnitProgress;playerSource:DUnitPlayerState;draft:string;key:string}
  const [storedSnapshot,setSnapshot]=useState<Snapshot|null>(null)
  const [invalidated,setInvalidated]=useState(false)
  const [confirmation,setConfirmation]=useState('')
  const [attempted,setAttempted]=useState(false)
  const [stale,setStale]=useState(false)
  const inputRef=useRef<HTMLInputElement>(null),typeRef=useRef<HTMLSelectElement>(null),statusRef=useRef<HTMLDivElement>(null)
  const pendingRegistrations=useRef(new Set<string>())
  const unit=progressionUnit(objective,'dunit'),parsed=parseProgressionTarget(draft,unit,'dunit')
  const locale={pt:'pt-BR',en:'en-US',es:'es',ko:'ko-KR'}[lang]
  const number=(value:number)=>value.toLocaleString(locale,{maximumFractionDigits:2})
  const objectiveLabelKey=progressionObjectiveLabelKey(objective)
  const objectiveLabel=objectiveLabelKey?t[objectiveLabelKey]:objective
  const qualifier=options.find(option=>option.key===key)?.qualifier??''
  const selectedLabel=[objectiveLabel,qualifier?t[progressionSubtypeLabelKey(qualifier)]??qualifier:'',`(${unit==='percent'?'%':t.ppPoints})`].filter(Boolean).join(' ')
  const valueLabel=(value:number)=>`+${number(value)} ${selectedLabel}`
  const invalidate=()=>{if(storedSnapshot){setInvalidated(true);setSnapshot(null)}setComparison([]);setCandidateQuery('');setVisibleRouteCount(DUNIT_ROUTE_PAGE_SIZE)}
  const snapshot=storedSnapshot&&storedSnapshot.draft===draft&&storedSnapshot.key===key?storedSnapshot:null
  const outdated=Boolean(snapshot&&(stale||snapshot.source!==progress||snapshot.playerSource!==playerState))
  const checklistProgress:DUnitProgress={...progress}
  pendingRegistrations.current.forEach(conditionId=>{const setId=conditionId.replace(/-condition-\d+$/,'');checklistProgress[setId]={...checklistProgress[setId],[conditionId]:true}})
  const [candidateQuery, setCandidateQuery] = useState('')
  const [visibleRouteCount, setVisibleRouteCount] = useState(DUNIT_ROUTE_PAGE_SIZE)
  const [comparison, setComparison] = useState<RouteLike[]>([])
  const calculate=()=>{
    setAttempted(true)
    if(!key){typeRef.current?.focus();return}
    if(!parsed.ok){inputRef.current?.focus();return}
    setSnapshot({...calculateDUnitGoalRoute(progress,key,parsed.value,playerState),source:progress,playerSource:playerState,draft,key});setStale(false);setInvalidated(false);setConfirmation('');setComparison([]);setCandidateQuery('');setVisibleRouteCount(DUNIT_ROUTE_PAGE_SIZE);pendingRegistrations.current.clear()
  }
  const start=useMemo(()=>({bonus:key?aggregateDUnitBonuses(progress)[key]??0:0,count:key?dUnitSets.flatMap(set=>set.conditions).filter(condition=>bonusKey(condition)===key&&isDUnitConditionCompleted(progress,condition)).length:0}),[progress,key])
  const register=(setId:string,conditionId:string)=>{
    if(!snapshot||pendingRegistrations.current.has(conditionId)||progress[setId]?.[conditionId]===true)return
    const containsCondition=(route:RouteLike)=>route.recommendations.some(item=>item.setId===setId&&item.condition.id===conditionId)
    if(!containsCondition(snapshot)&&!snapshot.alternatives.some(containsCondition)&&!snapshot.candidateAlternatives.some(containsCondition))return
    pendingRegistrations.current.add(conditionId);setStale(true);setConfirmation('ppConditionRecorded');toggle(setId,conditionId,true)
  }
  const routes = useMemo(() => snapshot ? filterDUnitCandidateRoutes(snapshot, candidateQuery) : [], [candidateQuery, snapshot])
  const visibleRoutes=routes.slice(0,visibleRouteCount)
  const compared = comparison
  const toggleComparison = (route: RouteLike) => setComparison(current => current.some(item => dUnitRouteSignature(item) === dUnitRouteSignature(route)) ? current.filter(item => dUnitRouteSignature(item) !== dUnitRouteSignature(route)) : [...current, route])
  const removeComparison = (route: RouteLike) => setComparison(current => current.filter(item => dUnitRouteSignature(item) !== dUnitRouteSignature(route)))
  return <>
    <div className="progression-start"><h2>{t.ppStart} · D-Unit</h2><p>{t.ppRecorded}</p>{key&&<><dl><div><dt>{t.ppCurrent}</dt><dd>{valueLabel(start.bonus)}</dd></div><div><dt>{t.ppCompleted}</dt><dd>{number(start.count)}</dd></div></dl>{!start.count&&<p>{t.ppNone}</p>}</>}<button className="quiet" onClick={go}>{t.ppUpdateDUnit}</button></div>
    <div ref={statusRef} tabIndex={-1} role="status" className="progression-status">{confirmation&&t[confirmation]}{invalidated&&<p>{t.ppRecalculate}</p>}</div>
    <section className="planner">
      <form className="control-panel" noValidate onSubmit={event=>{event.preventDefault();calculate()}}>
        {objective==='Dano habilidade'&&<><label htmlFor="dunit-type">{t.ppType}</label><select id="dunit-type" ref={typeRef} value={key} aria-invalid={attempted&&!key} aria-describedby="dunit-type-error" onChange={event=>{invalidate();setSelectedKey(event.target.value as DUnitBonusKey)}}><option value="">{t.ppChooseType}</option>{options.map(option=><option key={option.key} value={option.key}>{t[progressionSubtypeLabelKey(option.qualifier)]??option.qualifier}</option>)}</select><small id="dunit-type-error" className="progression-error">{attempted&&!key?t.ppTypeError:''}</small></>}
        <label htmlFor="dunit-target">{progressionText(t.ppTarget,{attribute:selectedLabel})}</label><input id="dunit-target" ref={inputRef} type="text" inputMode={unit==='percent'?'decimal':'numeric'} placeholder={unit==='percent'?'1,25':'500'} value={draft} aria-invalid={!parsed.ok&&(attempted||Boolean(draft))} aria-describedby="dunit-target-help dunit-target-error" onChange={event=>{invalidate();setDraft(event.target.value)}}/><small id="dunit-target-help">{selectedLabel}{unit==='percent'&&` · ${t.ppPercentHint}`}</small><small id="dunit-target-error" className="progression-error">{!parsed.ok&&(attempted||Boolean(draft))?t[parsed.error]:''}</small>
        <button type="submit" className="primary">{t.ppCalculateDUnit}</button>
      </form>
      <div className="plan-output">
        <span className="eyebrow">{t.ppCandidates}</span>
        {outdated&&<div className="progression-status" role="status"><b>{t.ppProgressUpdated}</b><p>{t.ppDUnitStale}</p><button className="quiet" onClick={calculate}>{t.ppRecalculateDUnit}</button></div>}
        {!snapshot ? <div className="empty">{t.ppReady}</div> : snapshot.maximum < snapshot.target ? <div className="empty">{snapshot.maximum===0?t.ppNoOptions:progressionText(t.ppDUnitInsufficient,{maximum:valueLabel(snapshot.maximum),target:valueLabel(snapshot.target)})}</div> : <>
          <p>{t.ppCostNotice}</p><details className="progression-limit"><summary>{t.details}</summary><p>{t.ppInventoryNotice}</p><p>{t.ppObtainment}</p></details>
          <div className="dunit-goal-header"><span>{t.attribute}: <b>{selectedLabel}</b></span><span>{t.dunitRequestedAdditional}: <b>+{snapshot.target} {selectedLabel}</b></span><span>{t.dunitCurrentBonus}: <b>+{snapshot.current} {selectedLabel}</b></span><span>{t.dunitProjectedTotal}: <b>+{snapshot.current + snapshot.totalGain} {selectedLabel}</b></span></div>
          <div className="dunit-candidate-browser">
            <label>{t.dunitSearchRoutes}<input value={candidateQuery} onChange={event=>{setCandidateQuery(event.target.value);setVisibleRouteCount(DUNIT_ROUTE_PAGE_SIZE)}} placeholder={t.dunitSearchRoutes}/><small>{t.dunitSearchHint}</small></label>
            <small>{candidateQuery ? `${visibleRoutes.length}/${routes.length} ${t.dunitRoutesFound}` : `${visibleRoutes.length}/${routes.length} ${t.dunitRouteCandidates}`}</small>
          </div>
          {routes.length===0 ? <div className="empty dunit-search-empty"><b>{t.dunitSearchNoCandidates}</b></div> : <div className="dunit-routes-list">{visibleRoutes.map((route,index) => <RouteCard key={dUnitRouteSignature(route)} route={route} index={index} progress={checklistProgress} snapshotProgress={snapshot.source} playerState={snapshot.playerSource} selected={comparison.some(item => dUnitRouteSignature(item) === dUnitRouteSignature(route))} onSelect={() => toggleComparison(route)} onComplete={register} t={t} selectedLabel={selectedLabel} currentBonus={snapshot.current}/>)}</div>}
          {routes.length>visibleRouteCount&&<button className="quiet dunit-load-more" onClick={()=>setVisibleRouteCount(value=>value+DUNIT_ROUTE_PAGE_SIZE)}>{t.dunitLoadMore}</button>}
          <RouteComparison routes={compared} t={t} selectedLabel={selectedLabel} progress={checklistProgress} playerState={snapshot.playerSource} onRemove={removeComparison} onClear={()=>setComparison([])}/>
        </>}
      </div>
    </section>
  </>
}
