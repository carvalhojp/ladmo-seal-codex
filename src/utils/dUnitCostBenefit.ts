import type { DUnitCondition, DUnitSet } from '../data/dUnitAudit'
import { dUnitCostMetadata, hasValidatedObtainmentCost, metadataForDUnitSet, type DUnitCostMetadata, type DUnitDigimonCostTier } from '../data/dUnitCostMetadata'
import { dUnitSetEvolutionLineProfiles, evolutionLineProfileForSet, evolutionLineTier, type DUnitSetEvolutionLineProfile } from '../data/dUnitEvolutionLineAudit'

export type DUnitConditionKind = 'obtained' | 'level' | 'transcendence' | 'unknown'
export type DUnitCostBenefitClass = 'veryAccessible' | 'accessible' | 'moderate' | 'difficult' | 'veryDifficult'
export type DUnitCostConfidence = 'high' | 'medium' | 'low'
export type DUnitRouteSelectionBasis = 'validatedIncrementalCost' | 'confirmedRequirementsOnly'
export type DUnitRecommendationReason = 'existingProgress' | 'sameSetProgression' | 'levelProgression' | 'transcendenceStep' | 'efficientBonus' | 'highDifficultyContent'
export type DUnitProgressLike = Record<string, Record<string, boolean>>
/**
 * Optional account facts for callers that have them. They are deliberately
 * separate from D-Unit checkbox progress: no ownership, evolution, level or
 * transcendence is inferred from a portrait or a checked-looking card.
 */
export type DUnitPlayerState = {
  ownedDigimonIds?: readonly string[]
  /** Form-specific unlocks; owning a line never unlocks all of its forms. */
  unlockedDigimonIds?: readonly string[]
  unlockedEvolutionLineIds?: readonly string[]
  levelByEvolutionLine?: Readonly<Record<string, number>>
  /** Per-form levels are retained for audited collective D-Unit requirements. */
  levelByDigimonId?: Readonly<Record<string, number>>
  transcendedDigimonIds?: readonly string[]
}
export type DUnitHighTierExposure = { sss:number; sssPlus:number; u:number; worstTier?:'sss'|'sss_plus'|'u' }
export type DUnitAccessibilityCeiling = 'normal' | 'sss' | 'sss_plus' | 'u'

/**
 * Goal Planner policy: minimize real player investment. SSS, SSS+ and U have
 * growing access penalties (U last resort), but remain valid when their total
 * route is genuinely cheaper than an extreme accessible alternative.
 */
export const DUNIT_COST_WEIGHTS = {
  accessBase: 3, accessPerDigimon: 2.2, levelBase: 1.5, levelPerHundred: 0.8,
  transcendenceBase: 9, transcendencePerDigimon: 2.1, unknownRequirement: 15, unknownAccessPenalty: 10,
  basicTier: 0, intermediateTier: 3, advancedTier: 8, unknownTier: 14, sssTier: 30, sssPlusTier: 52, uTier: 90,
  newSet: 3, completedConditionBonus: 2, maxStartedDiscount: 8,
  progressionStepValue: 3, progressionKindValue: 1.5, usefulBonusValue: 0.03, maxProgressionValue: 14,
  overkillPerPoint: 0.08,
} as const

export type DUnitCostBreakdown = { access:number; lineAccess:number; progression:number; transcendence:number; unknown:number; newSet:number; existingProgressCredit:number; progressionValue:number; overkill:number; total:number }
export type DUnitCostBenefitRecommendation = { setId:string; condition:DUnitCondition; estimatedCost:number; costBenefit:DUnitCostBenefitClass; reasons:DUnitRecommendationReason[]; highDifficultyTier?:'sss'|'sss_plus'|'u' }
export type DUnitCandidateRoute = { totalGain:number; totalCost:number; recommendations:DUnitCostBenefitRecommendation[]; setCount:number; unverifiedSetIds:string[] }
export type DUnitCostBenefitRoute = { current:number; target:number; maximum:number; totalGain:number; totalCost:number; costBenefit:DUnitCostBenefitClass; costConfidence:DUnitCostConfidence; selectionBasis:DUnitRouteSelectionBasis; unverifiedSetIds:string[]; unverifiedAlternativeSetIds:string[]; alternatives:DUnitCandidateRoute[]; candidateAlternatives:DUnitCandidateRoute[]; recommendations:DUnitCostBenefitRecommendation[]; setCount:number; accessibilityCeiling:DUnitAccessibilityCeiling; independentLineCount:number; unknownLineCount:number; lineDispersion:number; highTierExposure:DUnitHighTierExposure; costBreakdown:DUnitCostBreakdown; highDifficulty:boolean }
export type DUnitCostBenefitOptions = { sets:readonly DUnitSet[]; progress:DUnitProgressLike; keyFor:(condition:DUnitCondition)=>string; completed:(condition:DUnitCondition)=>boolean; key:string; target:number; metadata?:readonly DUnitCostMetadata[]; lineProfiles?:readonly DUnitSetEvolutionLineProfile[]; playerState?:DUnitPlayerState; accessibilityCeilingIndex?:number }

type Candidate = { set:DUnitSet; condition:DUnitCondition; benefit:number; kind:DUnitConditionKind; tier:DUnitDigimonCostTier }
type SetOption = { candidates:Candidate[]; gain:number; baseCost:number; breakdown:DUnitCostBreakdown; lineIds:string[]; unknownLineCount:number; highTier?:'sss'|'sss_plus'|'u'; started:boolean; confidence:DUnitCostConfidence; hasValidatedCost:boolean }
type Plan = { gain:number; cost:number; candidates:Candidate[]; lineIds:string[]; unknownLineCount:number; lineAccess:number; highTierCount:number; newSetCount:number; unverifiedSetCount:number; overkill:number; confidence:DUnitCostConfidence }

const numberFrom = (requirement:string) => Number(requirement.match(/\d+/)?.[0] ?? 0)
export const classifyDUnitRequirement = (requirement:string):DUnitConditionKind => {
  if (/^Obtido\s+\d+\s+Digimons\s+Transcendidos$/i.test(requirement)) return 'transcendence'
  if (/^Obtido\s+\d+\s+Digimons$/i.test(requirement)) return 'obtained'
  if (/^Nível\s+Total\s+dos\s+Digimons\s+\d+$/i.test(requirement)) return 'level'
  return 'unknown'
}
/** Requirement effort by itself; routes use the shared/marginal model below. */
export const requirementCost = (condition:DUnitCondition) => {
  const amount=numberFrom(condition.requirement)
  switch(classifyDUnitRequirement(condition.requirement)) {
    case 'obtained': return DUNIT_COST_WEIGHTS.accessBase+amount*DUNIT_COST_WEIGHTS.accessPerDigimon
    case 'level': return DUNIT_COST_WEIGHTS.levelBase+amount/100*DUNIT_COST_WEIGHTS.levelPerHundred
    case 'transcendence': return DUNIT_COST_WEIGHTS.transcendenceBase+amount*DUNIT_COST_WEIGHTS.transcendencePerDigimon
    default: return DUNIT_COST_WEIGHTS.unknownRequirement
  }
}
export const tierCost = (tier:DUnitDigimonCostTier) => ({basic:DUNIT_COST_WEIGHTS.basicTier,intermediate:DUNIT_COST_WEIGHTS.intermediateTier,advanced:DUNIT_COST_WEIGHTS.advancedTier,sss:DUNIT_COST_WEIGHTS.sssTier,sss_plus:DUNIT_COST_WEIGHTS.sssPlusTier,u:DUNIT_COST_WEIGHTS.uTier,unknown:DUNIT_COST_WEIGHTS.unknownTier}[tier])
const highTier=(tier:DUnitDigimonCostTier)=>tier==='sss'||tier==='sss_plus'||tier==='u'?tier:undefined
const accessibilityOrder:readonly DUnitAccessibilityCeiling[]=['normal','sss','sss_plus','u']
/** Unknown is not a rank: it remains in the normal search with a conservative cost and low confidence. */
const accessibilityIndex=(tier:DUnitDigimonCostTier)=>tier==='u'?3:tier==='sss_plus'?2:tier==='sss'?1:0
const largest=(values:number[])=>values.length?Math.max(...values):0
const subsetOptions=<T,>(items:T[]):T[][]=>Array.from({length:1<<items.length},(_,mask)=>items.filter((_,index)=>(mask&(1<<index))!==0))
const completedInSet=(progress:DUnitProgressLike,set:DUnitSet)=>set.conditions.filter(condition=>progress[set.id]?.[condition.id]===true)

const tierForSet=(setId:string,metadata:readonly DUnitCostMetadata[]):DUnitDigimonCostTier=>{
  const entries=metadataForDUnitSet(setId,metadata); if(!entries.length)return 'unknown'
  const tiers:DUnitDigimonCostTier[]=['basic','intermediate','advanced','sss','sss_plus','u']
  return entries.map(entry=>entry.tier).sort((a,b)=>tiers.indexOf(b)-tiers.indexOf(a))[0]!
}
const confidenceForSet=(set:DUnitSet,metadata:readonly DUnitCostMetadata[],profile?:DUnitSetEvolutionLineProfile):DUnitCostConfidence=>{
  const entries=metadataForDUnitSet(set.id,metadata), expected=Math.max(1,...set.conditions.map(condition=>condition.digimonNames.length))
  const rankConfidence=!entries.length?'low':entries.length>=expected?'high':'medium'
  const lineConfidence=!profile||profile.confidence==='unknown'||profile.unknownLineCount!==0?'low':profile.confidence==='probable'?'medium':'high'
  const obtainmentConfidence=hasValidatedObtainmentCost(set.id,metadata)?'high':'low'
  return mergeConfidence(mergeConfidence(rankConfidence,lineConfidence),obtainmentConfidence)
}
const mergeConfidence=(left:DUnitCostConfidence,right:DUnitCostConfidence):DUnitCostConfidence=>left==='low'||right==='low'?'low':left==='medium'||right==='medium'?'medium':'high'

/**
 * A useful package pays set access once, then only the highest marginal
 * level/transcendence step. Confirmed line costs are attached later, globally,
 * so a line shared by two selected sets is paid once.
 */
const optionFor=(set:DUnitSet,candidates:Candidate[],completed:DUnitCondition[],metadata:readonly DUnitCostMetadata[],profiles:readonly DUnitSetEvolutionLineProfile[],playerState:DUnitPlayerState):SetOption=>{
  const tier=candidates[0]?.tier??'unknown', started=completed.length>0
  const profile=evolutionLineProfileForSet(set.id,profiles)
  const lineIds=started?[]:[...(profile?.evolutionLineIds??[])]
  // A null profile count means "unresolved", not zero. It contributes one
  // uncertainty marker to diagnostics while retaining the conservative legacy
  // access proxy below; it never asserts a fictitious independent line.
  const unknownLineCount=started?0:(profile?.unknownLineCount===null||!profile?1:profile.unknownLineCount)
  const selectedLevels=candidates.filter(candidate=>candidate.kind==='level').map(candidate=>numberFrom(candidate.condition.requirement))
  const accountLevel=Math.max(0,...lineIds.map(lineId=>playerState.levelByEvolutionLine?.[lineId]??0))
  const completedLevels=[...completed.filter(condition=>classifyDUnitRequirement(condition.requirement)==='level').map(condition=>numberFrom(condition.requirement)),accountLevel]
  const selectedTrans=candidates.filter(candidate=>candidate.kind==='transcendence').map(candidate=>numberFrom(candidate.condition.requirement))
  const auditedDigimon=metadataForDUnitSet(set.id,metadata).map(entry=>entry.digimonId)
  const accountTrans=auditedDigimon.filter(id=>playerState.transcendedDigimonIds?.includes(id)).length
  const completedTrans=[...completed.filter(condition=>classifyDUnitRequirement(condition.requirement)==='transcendence').map(condition=>numberFrom(condition.requirement)),accountTrans]
  const levelDelta=Math.max(0,largest(selectedLevels)-largest(completedLevels)), transDelta=Math.max(0,largest(selectedTrans)-largest(completedTrans))
  // Only selected conditions may add work to a route.  The old fallback used
  // the largest count anywhere in the whole set, which silently charged an
  // unselected condition and effectively treated its portrait count as an
  // acquisition-cost proxy.  With no audited composition, only an explicitly
  // selected obtain/transcendence threshold is safe to use as a count proxy;
  // a level-only condition remains explicitly uncertain instead.
  const selectedAccessCounts=candidates
    .filter(candidate=>candidate.kind==='obtained'||candidate.kind==='transcendence')
    .map(candidate=>numberFrom(candidate.condition.requirement))
  const legacyLineProxy=!profile&&!started?(selectedAccessCounts.length?largest(selectedAccessCounts)*DUNIT_COST_WEIGHTS.accessPerDigimon:0):0
  const partialProfileProxy=profile?.unknownLineCount===null&&selectedAccessCounts.length?largest(selectedAccessCounts)*DUNIT_COST_WEIGHTS.accessPerDigimon:0
  const ownsAllAuditedMembers=auditedDigimon.length>0&&auditedDigimon.every(id=>playerState.ownedDigimonIds?.includes(id))
  const access=started||ownsAllAuditedMembers?0:DUNIT_COST_WEIGHTS.accessBase+legacyLineProxy+partialProfileProxy
  // Missing line evidence does not make a known-rank set fictitiously more
  // expensive: its non-deduplicated legacy proxy is already conservative.
  // Apply the explicit uncertainty penalty when rank or a partial line audit
  // is genuinely unresolved.
  const unknown=!started&&(tier==='unknown'||profile?.unknownLineCount===null)?DUNIT_COST_WEIGHTS.unknownAccessPenalty:0
  const progression=levelDelta?DUNIT_COST_WEIGHTS.levelBase+levelDelta/100*DUNIT_COST_WEIGHTS.levelPerHundred:0
  const transcendence=transDelta?DUNIT_COST_WEIGHTS.transcendenceBase+transDelta*DUNIT_COST_WEIGHTS.transcendencePerDigimon:0
  const unknownRequirements=candidates.filter(candidate=>candidate.kind==='unknown').length*DUNIT_COST_WEIGHTS.unknownRequirement
  const existingProgressCredit=Math.min(DUNIT_COST_WEIGHTS.maxStartedDiscount,completed.length*DUNIT_COST_WEIGHTS.completedConditionBonus)
  const kinds=new Set(candidates.map(candidate=>candidate.kind).filter(kind=>kind!=='unknown'))
  const progressionValue=candidates.length>1?Math.min(DUNIT_COST_WEIGHTS.maxProgressionValue,(candidates.length-1)*DUNIT_COST_WEIGHTS.progressionStepValue+kinds.size*DUNIT_COST_WEIGHTS.progressionKindValue+candidates.reduce((sum,candidate)=>sum+candidate.benefit,0)*DUNIT_COST_WEIGHTS.usefulBonusValue):0
  const breakdown:DUnitCostBreakdown={access,lineAccess:0,progression,transcendence,unknown:unknown+unknownRequirements,newSet:started?0:DUNIT_COST_WEIGHTS.newSet,existingProgressCredit,progressionValue,overkill:0,total:0}
  // A confirmed evolution line carries its tier once in the global line
  // charge. Unresolved profiles retain the established per-set tier cost.
  const legacyTierCost=profile?.confidence==='confirmed'?0:tierCost(tier)
  // Fixture callers may supply fully audited metadata without a separate
  // line-profile record. In the application data, a present profile must be
  // confirmed as well; absent metadata never becomes validated by default.
  const hasValidatedCost=hasValidatedObtainmentCost(set.id,metadata)&&(!profile||profile.confidence==='confirmed')
  const verifiedCost=access+legacyTierCost+progression+transcendence+breakdown.unknown+breakdown.newSet-existingProgressCredit-progressionValue
  // An unverified set is still a usable route candidate, but its ordering may
  // only use explicitly confirmed D-Unit work (level/transcendence/progress),
  // never an invented obtainment/rank price.
  const explicitTaskCost=progression+transcendence+unknownRequirements+breakdown.newSet-existingProgressCredit-progressionValue
  const baseCost=Math.max(.1,hasValidatedCost?verifiedCost:explicitTaskCost)
  return {candidates,gain:candidates.reduce((sum,candidate)=>sum+candidate.benefit,0),baseCost,breakdown,lineIds,unknownLineCount,highTier:highTier(tier),started,confidence:confidenceForSet(set,metadata,profile),hasValidatedCost}
}
const comparePlans=(left:Plan,right:Plan)=>left.unverifiedSetCount-right.unverifiedSetCount||left.cost-right.cost||left.highTierCount-right.highTierCount||left.lineIds.length-right.lineIds.length||left.newSetCount-right.newSetCount||left.overkill-right.overkill||left.candidates.length-right.candidates.length||left.candidates.map(candidate=>candidate.condition.id).join('|').localeCompare(right.candidates.map(candidate=>candidate.condition.id).join('|'))
const bestPlan=(plans:Iterable<Plan>)=>[...plans].sort(comparePlans)[0]
const lineAccessCost=(lineId:string, fallbackTier:DUnitDigimonCostTier)=>DUNIT_COST_WEIGHTS.accessPerDigimon+tierCost(evolutionLineTier(lineId)==='unknown'?fallbackTier:evolutionLineTier(lineId))
const uniqueLineIds=(lineIds:readonly string[])=>[...new Set(lineIds)].sort()
const lineSignature=(lineIds:readonly string[])=>uniqueLineIds(lineIds).join('|')
/** Keeps the global DP bounded when future audits contain many known lines. */
export const DUNIT_MAX_LINE_STATES_PER_GAIN=32
const trimStates=(states:Map<string,Plan>)=>{
  const byGain=new Map<number,Plan[]>()
  for(const plan of states.values())byGain.set(plan.gain,[...(byGain.get(plan.gain)??[]),plan])
  const trimmed=new Map<string,Plan>()
  for(const [gain,plans] of byGain)for(const plan of plans.sort(comparePlans).slice(0,DUNIT_MAX_LINE_STATES_PER_GAIN))trimmed.set(`${gain}:${lineSignature(plan.lineIds)}:${plan.candidates.map(candidate=>candidate.condition.id).join('|')}`,plan)
  return trimmed
}
const planSignature=(plan:Plan)=>plan.candidates.map(candidate=>candidate.condition.id).sort().join('|')
const planSetCount=(plan:Plan)=>new Set(plan.candidates.map(candidate=>candidate.set.id)).size
const planShape=(plan:Plan)=>`${planSetCount(plan)}:${plan.candidates.length}:${[...new Set(plan.candidates.map(candidate=>candidate.kind))].sort().join(',')}`
/**
 * Requirements-only routes must not inherit the regular cost sort: that sort
 * is useful only with audited obtainment data. Keep one representative for
 * each structural shape so a three-set shortcut cannot erase a longer,
 * differently-progressed candidate before the player can inspect it.
 */
const selectDiversePlans=(plans:Iterable<Plan>,needed:number,excluded:Plan)=>{
  const unique=[...new Map([...plans].filter(plan=>plan.gain>=needed&&planSignature(plan)!==planSignature(excluded)).map(plan=>[planSignature(plan),plan])).values()]
  const representativeByShape=new Map<string,Plan>()
  for(const plan of unique){
    const shape=planShape(plan), previous=representativeByShape.get(shape)
    if(!previous||plan.overkill<previous.overkill||(plan.overkill===previous.overkill&&planSignature(plan).localeCompare(planSignature(previous))<0))representativeByShape.set(shape,plan)
  }
  // The compact default view uses one representative per route structure.
  // The full frontier remains available through the candidate search below.
  return [...representativeByShape.values()].sort((left,right)=>
    planSetCount(left)-planSetCount(right)||left.candidates.length-right.candidates.length||left.overkill-right.overkill||planSignature(left).localeCompare(planSignature(right))
  ).slice(0,24)
}
export const costBenefitClass=(cost:number,confidence:DUnitCostConfidence='high'):DUnitCostBenefitClass=>{
  const conservative=cost+(confidence==='low'?4:confidence==='medium'?2:0)
  return conservative<=8?'veryAccessible':conservative<=16?'accessible':conservative<=30?'moderate':conservative<=50?'difficult':'veryDifficult'
}
const emptyBreakdown=():DUnitCostBreakdown=>({access:0,lineAccess:0,progression:0,transcendence:0,unknown:0,newSet:0,existingProgressCredit:0,progressionValue:0,overkill:0,total:0})
const emptyExposure=():DUnitHighTierExposure=>({sss:0,sssPlus:0,u:0})
const emptyRoute=(current:number,target:number,maximum:number,accessibilityCeiling:DUnitAccessibilityCeiling='normal'):DUnitCostBenefitRoute=>({current,target,maximum,totalGain:0,totalCost:0,costBenefit:'veryAccessible',costConfidence:'high',selectionBasis:'validatedIncrementalCost',unverifiedSetIds:[],unverifiedAlternativeSetIds:[],alternatives:[],candidateAlternatives:[],recommendations:[],setCount:0,accessibilityCeiling,independentLineCount:0,unknownLineCount:0,lineDispersion:0,highTierExposure:emptyExposure(),costBreakdown:emptyBreakdown(),highDifficulty:false})

/**
 * DP over useful per-set packages (at most 15 each). Since a whole set is
 * processed at once, keeping the cheapest state for a gain cannot erase a
 * later same-set progression path.
 */
export function calculateDUnitCostBenefitRoute({sets,progress,keyFor,completed,key,target,metadata=dUnitCostMetadata,lineProfiles=dUnitSetEvolutionLineProfiles,playerState={},accessibilityCeilingIndex}:DUnitCostBenefitOptions):DUnitCostBenefitRoute {
  const matching=sets.flatMap(set=>set.conditions.map(condition=>({set,condition}))).filter(({condition})=>condition.confirmed&&condition.bonus.value!=null&&keyFor(condition)===key)
  const current=matching.filter(({condition})=>completed(condition)).reduce((sum,{condition})=>sum+(condition.bonus.value??0),0)
  const pending=matching.filter(({condition})=>!completed(condition)).map(({set,condition})=>({set,condition,benefit:condition.bonus.value??0,kind:classifyDUnitRequirement(condition.requirement),tier:tierForSet(set.id,metadata)} satisfies Candidate))
  const setHasValidatedCost=(setId:string)=>{const profile=evolutionLineProfileForSet(setId,lineProfiles);return hasValidatedObtainmentCost(setId,metadata)&&(!profile||profile.confidence==='confirmed')}
  const withUnverifiedAlternatives=(route:DUnitCostBenefitRoute):DUnitCostBenefitRoute=>{
    const chosen=new Set(route.recommendations.map(item=>item.setId))
    const unverifiedAlternativeSetIds=[...new Set(pending.filter(candidate=>!chosen.has(candidate.set.id)&&!setHasValidatedCost(candidate.set.id)).map(candidate=>candidate.set.id))].sort()
    return {...route,unverifiedAlternativeSetIds}
  }
  const needed=Math.max(0,target)
  const ceilingIndex=accessibilityOrder.findIndex((_,index)=>pending.filter(candidate=>accessibilityIndex(candidate.tier)<=index).reduce((sum,candidate)=>sum+candidate.benefit,0)>=needed)
  // Select the smallest cumulative high-rank layer that can meet the target:
  // normal, then SSS, then SSS+, then U. Unknown is never promoted to a
  // confirmed accessible rank; it merely stays conservative in normal.
  const selectedCeilingIndex=accessibilityCeilingIndex??(ceilingIndex<0?accessibilityOrder.length-1:ceilingIndex)
  const accessibilityCeiling=accessibilityOrder[selectedCeilingIndex]!
  const eligible=pending.filter(candidate=>accessibilityIndex(candidate.tier)<=selectedCeilingIndex)
  const pendingBySet=new Map<string,Candidate[]>()
  for(const candidate of eligible)pendingBySet.set(candidate.set.id,[...(pendingBySet.get(candidate.set.id)??[]),candidate])
  const allPending=[...pendingBySet.values()].flat(), maximum=allPending.reduce((sum,candidate)=>sum+candidate.benefit,0)
  if(!needed||!allPending.length)return withUnverifiedAlternatives(emptyRoute(current,target,maximum,accessibilityCeiling))
  const setOptions=[...pendingBySet.values()].map(candidates=>{const set=candidates[0]!.set;return subsetOptions(candidates).filter(option=>option.length>0).map(option=>optionFor(set,option,completedInSet(progress,set),metadata,lineProfiles,playerState))})
  const openedLines=uniqueLineIds([...sets.filter(set=>completedInSet(progress,set).length>0).flatMap(set=>evolutionLineProfileForSet(set.id,lineProfiles)?.evolutionLineIds??[]),...(playerState.unlockedEvolutionLineIds??[])])
  if(maximum<target){const sorted=allPending.sort((a,b)=>a.condition.id.localeCompare(b.condition.id));return withUnverifiedAlternatives(buildRoute(current,target,maximum,sorted,sorted.reduce((sum,candidate)=>sum+requirementCost(candidate.condition),0),new Map(),'low',openedLines,0,0,accessibilityCeiling))}
  const emptyPlan:Plan={gain:0,cost:0,candidates:[],lineIds:openedLines,unknownLineCount:0,lineAccess:0,highTierCount:0,newSetCount:0,unverifiedSetCount:0,overkill:0,confidence:'high'}
  const extendPlan=(plan:Plan,option:SetOption):Plan=>{
    const newLineIds=option.lineIds.filter(lineId=>!plan.lineIds.includes(lineId)),lineIds=uniqueLineIds([...plan.lineIds,...newLineIds]),rawGain=plan.gain+option.gain,gain=Math.min(needed,rawGain),overkill=Math.max(0,rawGain-needed),lineAccess=option.hasValidatedCost?newLineIds.reduce((sum,lineId)=>sum+lineAccessCost(lineId,option.candidates[0]?.tier??'unknown'),0):0
    return {gain,cost:plan.cost+option.baseCost+lineAccess+overkill*DUNIT_COST_WEIGHTS.overkillPerPoint,candidates:[...plan.candidates,...option.candidates],lineIds,unknownLineCount:plan.unknownLineCount+option.unknownLineCount,lineAccess:plan.lineAccess+lineAccess,highTierCount:plan.highTierCount+(option.highTier?1:0),newSetCount:plan.newSetCount+(option.started?0:1),unverifiedSetCount:plan.unverifiedSetCount+(option.hasValidatedCost?0:1),overkill,confidence:mergeConfidence(plan.confidence,option.confidence)}
  }
  let states=new Map<string,Plan>([[`0:${lineSignature(openedLines)}`,emptyPlan]])
  for(const options of setOptions){const next=new Map(states);for(const plan of states.values())for(const option of options){const candidate=extendPlan(plan,option),stateKey=`${candidate.gain}:${lineSignature(candidate.lineIds)}:${planSignature(candidate)}`,previous=next.get(stateKey);if(!previous||comparePlans(candidate,previous)<0)next.set(stateKey,candidate)}states=trimStates(next)}
  const chosen=bestPlan([...states.values()].filter(plan=>plan.gain>=needed))!
  // Recover the exact per-set package that was chosen by the DP. Matching any
  // overlapping candidate would accidentally use a larger package from the
  // same set for display costs and diagnostics, even when the route selected
  // only one of its pending conditions.
  const optionsFor=(plan:Plan)=>new Map(setOptions.flatMap(options=>{
    const setId=options[0]?.candidates[0]?.set.id
    if(!setId)return []
    const chosenIds=new Set(plan.candidates.filter(candidate=>candidate.set.id===setId).map(candidate=>candidate.condition.id))
    const exact=options.find(option=>option.candidates.length===chosenIds.size&&option.candidates.every(candidate=>chosenIds.has(candidate.condition.id)))
    return exact?[[setId,exact] as const]:[]
  }))
  const toRoute=(plan:Plan)=>buildRoute(current,target,maximum,plan.candidates,plan.cost,optionsFor(plan),plan.confidence,plan.lineIds,plan.unknownLineCount,plan.lineAccess,accessibilityCeiling)
  const primary=withUnverifiedAlternatives(toRoute(chosen))
  // When actual obtainment cost cannot be compared, keep several distinct
  // valid combinations for the player instead of presenting catalog order as
  // an economic conclusion.
  if(primary.selectionBasis==='confirmedRequirementsOnly'){
    // Build an additional candidate frontier from complete early progression
    // packages (the first three confirmed steps of each set). This is generic
    // for every attribute and prevents the cost DP's bounded frontier from
    // dropping a legitimate multi-set progression merely because it has more
    // stages than a one-condition shortcut. These are candidates, not costs.
    const progressionPackages=setOptions.map(options=>{
      const earlyIds=new Set(options.flatMap(option=>option.candidates).filter(candidate=>candidate.condition.position<=3).map(candidate=>candidate.condition.id))
      return options.find(option=>option.candidates.length===earlyIds.size&&option.candidates.every(candidate=>earlyIds.has(candidate.condition.id)))
    }).filter((option):option is SetOption=>option !== undefined && option.gain>0)
    let packagePlans:Plan[]=[emptyPlan]
    const maximumCandidateSets=4
    for(const option of progressionPackages){
      const additions=packagePlans.filter(plan=>planSetCount(plan)<maximumCandidateSets&&plan.gain<needed).map(plan=>extendPlan(plan,option))
      packagePlans=[...packagePlans,...additions]
    }
    const candidatePlans=[...new Map([...states.values(),...packagePlans].filter(plan=>plan.gain>=needed&&planSignature(plan)!==planSignature(chosen)).map(plan=>[planSignature(plan),plan])).values()]
    const asCandidate=(plan:Plan):DUnitCandidateRoute=>{
      const selectedCounts=new Map<string,number>();plan.candidates.forEach(candidate=>selectedCounts.set(candidate.set.id,(selectedCounts.get(candidate.set.id)??0)+1))
      return {totalGain:needed+plan.overkill,totalCost:plan.cost,setCount:selectedCounts.size,unverifiedSetIds:[...selectedCounts.keys()].filter(setId=>!setHasValidatedCost(setId)).sort(),recommendations:[...plan.candidates].sort((left,right)=>left.set.id.localeCompare(right.set.id)||left.condition.position-right.condition.position).map(candidate=>({setId:candidate.set.id,condition:candidate.condition,estimatedCost:requirementCost(candidate.condition),costBenefit:costBenefitClass(requirementCost(candidate.condition),'low'),reasons:((selectedCounts.get(candidate.set.id)??0)>1?['sameSetProgression']:['efficientBonus']) as DUnitRecommendationReason[],highDifficultyTier:highTier(candidate.tier)}))}
    }
    const alternatives=selectDiversePlans(candidatePlans,needed,chosen).map(asCandidate)
    // Keep the complete requirement-only frontier available to the UI search.
    // The visible portfolio is compact, while no valid route is silently
    // discarded merely because it has a different number of sets or stages.
    return {...primary,alternatives,candidateAlternatives:candidatePlans.map(asCandidate)}
  }
  return primary
}
function buildRoute(current:number,target:number,maximum:number,candidates:Candidate[],totalCost:number,selectedOptions:Map<string,SetOption>,confidence:DUnitCostConfidence='low',lineIds:string[]=[],unknownLineCount=0,lineAccess=0,accessibilityCeiling:DUnitAccessibilityCeiling='u'):DUnitCostBenefitRoute {
  const selectedCounts=new Map<string,number>();for(const candidate of candidates)selectedCounts.set(candidate.set.id,(selectedCounts.get(candidate.set.id)??0)+1)
  const recommendations=[...candidates].sort((a,b)=>a.set.id.localeCompare(b.set.id)||a.condition.position-b.condition.position).map(candidate=>{const option=selectedOptions.get(candidate.set.id),reasons:DUnitRecommendationReason[]=[];if(option?.started)reasons.push('existingProgress');if((selectedCounts.get(candidate.set.id)??0)>1)reasons.push('sameSetProgression');if(candidate.kind==='level')reasons.push('levelProgression');if(candidate.kind==='transcendence')reasons.push('transcendenceStep');if(!reasons.length)reasons.push('efficientBonus');if(highTier(candidate.tier))reasons.push('highDifficultyContent');const divisor=selectedCounts.get(candidate.set.id)??1,estimatedCost=Math.max(.1,option?option.baseCost/divisor:requirementCost(candidate.condition)+tierCost(candidate.tier));return {setId:candidate.set.id,condition:candidate.condition,estimatedCost,costBenefit:costBenefitClass(estimatedCost,option?.confidence??confidence),reasons,highDifficultyTier:highTier(candidate.tier)}})
  const totalGain=recommendations.reduce((sum,item)=>sum+(item.condition.bonus.value??0),0)
  const costBreakdown=[...selectedOptions.values()].reduce((total,option)=>{for(const key of ['access','progression','transcendence','unknown','newSet','existingProgressCredit','progressionValue'] as const)total[key]+=option.breakdown[key];return total},emptyBreakdown())
  costBreakdown.lineAccess=lineAccess
  costBreakdown.overkill=Math.max(0,totalCost-(costBreakdown.access+costBreakdown.lineAccess+costBreakdown.progression+costBreakdown.transcendence+costBreakdown.unknown+costBreakdown.newSet-costBreakdown.existingProgressCredit-costBreakdown.progressionValue))
  costBreakdown.total=totalCost
  // Exposure is infrastructure-oriented: a high-tier set contributes once,
  // even when its route contains several marginal condition steps.
  const highTierExposure=[...selectedOptions.values()].reduce((exposure,option)=>{if(option.highTier==='sss')exposure.sss++;if(option.highTier==='sss_plus')exposure.sssPlus++;if(option.highTier==='u')exposure.u++;return exposure},emptyExposure())
  highTierExposure.worstTier=highTierExposure.u?'u':highTierExposure.sssPlus?'sss_plus':highTierExposure.sss?'sss':undefined
  const unverifiedSetIds=[...selectedCounts.keys()].filter(setId=>!selectedOptions.get(setId)?.hasValidatedCost).sort()
  const selectionBasis:DUnitRouteSelectionBasis=unverifiedSetIds.length?'confirmedRequirementsOnly':'validatedIncrementalCost'
  return {current,target,maximum,totalGain,totalCost,costBenefit:costBenefitClass(totalCost,confidence),costConfidence:confidence,selectionBasis,unverifiedSetIds,unverifiedAlternativeSetIds:[],alternatives:[],candidateAlternatives:[],recommendations,setCount:selectedCounts.size,accessibilityCeiling,independentLineCount:lineIds.length,unknownLineCount,lineDispersion:lineIds.length+unknownLineCount,highTierExposure,costBreakdown,highDifficulty:recommendations.some(item=>item.highDifficultyTier!=null)}
}
