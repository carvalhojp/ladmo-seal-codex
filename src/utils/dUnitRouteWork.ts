import { type DUnitCondition } from '../data/dUnitAudit'
import { identitiesForDUnitSet, type DUnitPortraitIdentityAudit } from '../data/dUnitPortraitIdentityAudit'
import { progressionAuditForDUnitPortrait } from '../data/dUnitPortraitProgressionAudit'
import { portraitsForDUnitSet } from '../data/dUnitPortraits'
import { classifyDUnitRequirement, type DUnitConditionKind, type DUnitPlayerState } from './dUnitCostBenefit'

export type DUnitKnownSetMembers = { complete:boolean; members:readonly DUnitPortraitIdentityAudit[] }
export type DUnitRouteWork = {
  setId:string; condition:DUnitCondition; kind:DUnitConditionKind; completeIdentity:boolean
  memberIds:readonly string[]; memberNames:readonly string[]; owned:readonly string[]; ownedNames:readonly string[]
  missingOwned:number; missingOwnedIds:readonly string[]; missingOwnedNames:readonly string[]
  missingEvolution:readonly string[]; missingEvolutionIds:readonly string[]
  levelCurrent?:number; levelRemaining?:number
  missingTranscendence:number; missingTranscendenceIds:readonly string[]; missingTranscendenceNames:readonly string[]
}
export type DUnitRouteWorkComparison = {
  /** All audited forms appearing in both routes, regardless of the player's progress. */
  confirmedShared:readonly string[]
  /** Audited work still outstanding in both routes. Never includes a completed base acquisition. */
  remainingShared:readonly string[]
  remainingOnlyLeft:readonly string[]
  remainingOnlyRight:readonly string[]
  similarButDifferent:readonly string[]; unknownSharing:readonly string[]
}

/** A set is usable for member-level work only when every pictured position is audited. */
export const knownMembersForDUnitSet=(setId:string):DUnitKnownSetMembers=>{
  const expected=portraitsForDUnitSet(setId).length
  const members=identitiesForDUnitSet(setId).filter(identity=>identity.portraitIndex!=null&&identity.digimonId)
  const complete=expected>0&&members.length===expected&&new Set(members.map(member=>member.portraitIndex)).size===expected
  return {complete,members:complete?members:[]}
}

const target=(condition:DUnitCondition)=>Number(condition.requirement.match(/\d+/)?.[0]??0)
const title=(identity:DUnitPortraitIdentityAudit)=>`${identity.canonicalName}${identity.variant?` [${identity.variant}]`:''}`
export const describeDUnitRouteWork=(setId:string,condition:DUnitCondition,player:DUnitPlayerState={}, known=knownMembersForDUnitSet(setId)):DUnitRouteWork=>{
  const kind=classifyDUnitRequirement(condition.requirement), members=known.members
  const memberIds=members.map(member=>member.digimonId!).filter(Boolean)
  const owned=memberIds.filter(id=>player.ownedDigimonIds?.includes(id))
  const nameById=new Map(members.map(member=>[member.digimonId!,title(member)]))
  const missingEvolutionIds=members.filter(member=>{
    const audit=progressionAuditForDUnitPortrait(setId, member.portraitIndex!)
    if(audit?.evolutionStatus==='confirmed') return audit.relationship!=='base'&&!player.unlockedDigimonIds?.includes(member.digimonId!)
    return Boolean(member.evolutionLineId&&!player.unlockedEvolutionLineIds?.includes(member.evolutionLineId))
  }).map(member=>member.digimonId!)
  const levelTotal=memberIds.reduce((sum,id)=>sum+(player.levelByDigimonId?.[id]??0),0)
  const transcended=memberIds.filter(id=>player.transcendedDigimonIds?.includes(id)).length
  const missingOwnedIds=known.complete&&kind==='obtained'?memberIds.filter(id=>!owned.includes(id)):[]
  const missingTranscendenceIds=known.complete&&kind==='transcendence'?memberIds.filter(id=>!player.transcendedDigimonIds?.includes(id)):[]
  return {setId,condition,kind,completeIdentity:known.complete,memberIds,memberNames:members.map(title),owned,ownedNames:owned.map(id=>nameById.get(id)??id),
    missingOwned:Math.min(target(condition),missingOwnedIds.length), missingOwnedIds, missingOwnedNames:missingOwnedIds.map(id=>nameById.get(id)??id),
    missingEvolution:known.complete?missingEvolutionIds.map(id=>nameById.get(id)??id):[], missingEvolutionIds:known.complete?missingEvolutionIds:[],
    ...(known.complete&&kind==='level'?{levelCurrent:levelTotal,levelRemaining:Math.max(0,target(condition)-levelTotal)}:{}),
    missingTranscendence:Math.min(target(condition),missingTranscendenceIds.length), missingTranscendenceIds, missingTranscendenceNames:missingTranscendenceIds.map(id=>nameById.get(id)??id),
  }
}

/**
 * Text is only a clue that two tasks look alike. Reuse is asserted solely
 * after both compositions are complete and contain the same audited form.
 */
export const compareDUnitRouteWork=(left:readonly DUnitRouteWork[],right:readonly DUnitRouteWork[]):DUnitRouteWorkComparison=>{
  const confirmedShared=new Set<string>(), similarButDifferent=new Set<string>(), unknownSharing=new Set<string>()
  for(const a of left) for(const b of right) {
    if(a.kind!==b.kind) continue
    const sameText=a.condition.requirement===b.condition.requirement
    if(a.completeIdentity&&b.completeIdentity) {
      const common=a.memberIds.filter(id=>b.memberIds.includes(id))
      if(common.length) common.forEach(id=>confirmedShared.add(id))
      else if(sameText) similarButDifferent.add(a.condition.requirement)
    } else if(sameText) unknownSharing.add(a.condition.requirement)
  }
  const remaining=(items:readonly DUnitRouteWork[])=>new Set(items.flatMap(item=>[
    ...item.missingOwnedIds,...item.missingEvolutionIds,...item.missingTranscendenceIds,
  ]))
  const names=new Map([...left,...right].flatMap(item=>item.memberIds.map((id,index)=>[id,item.memberNames[index]??id] as const)))
  const leftRemaining=remaining(left),rightRemaining=remaining(right)
  const named=(ids:Iterable<string>)=>[...ids].map(id=>names.get(id)??id).sort()
  return {
    confirmedShared:[...confirmedShared].sort(),
    remainingShared:named([...leftRemaining].filter(id=>rightRemaining.has(id))),
    remainingOnlyLeft:named([...leftRemaining].filter(id=>!rightRemaining.has(id))),
    remainingOnlyRight:named([...rightRemaining].filter(id=>!leftRemaining.has(id))),
    similarButDifferent:[...similarButDifferent].sort(),unknownSharing:[...unknownSharing].sort(),
  }
}
