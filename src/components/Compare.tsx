import { useState } from 'react'
import { X } from 'lucide-react'
import { seals } from '../data/seals'
import type { Seal } from '../types'
import { costPerSeal, efficiency, formatValue } from '../utils/calculations'
import { PageHead } from './PageHead'
import { localizedSealName } from '../data/localizedSealNames'
import type { Lang } from '../App'
export function Compare({t,lang}:{t:any,lang:Lang}){const [ids,setIds]=useState<string[]>([]);const chosen=seals.filter(s=>ids.includes(s.id));return <><PageHead eyebrow={t.compareEyebrow} title={t.compare} text={t.compareDescription}/><div className="compare-picker"><select value="" onChange={e=>e.target.value&&!ids.includes(e.target.value)&&setIds([...ids,e.target.value])}><option value="">{t.addSeal}</option>{seals.map(s=><option value={s.id} key={s.id}>{localizedSealName(s,lang)} — {s.attribute}</option>)}</select>{ids.length>0&&<button className="quiet" onClick={()=>setIds([])}>{t.clear}</button>}</div>{chosen.length?<div className="compare-table"><div className="compare-row labels"><span>{t.criterion}</span>{chosen.map(s=><b key={s.id}>{localizedSealName(s,lang)}<button onClick={()=>setIds(ids.filter(x=>x!==s.id))}><X size={14}/></button></b>)}</div>{[[t.attribute,(s:Seal)=>s.attribute],['Master',(s:Seal)=>formatValue(s.masterValue,s.attribute)],[t.exchangeLabel,(s:Seal)=>`${s.ticketCost} → ${s.sealsReceived}`],[t.costPerSeal,(s:Seal)=>costPerSeal(s).toFixed(2)],[t.bonusPerTicket,(s:Seal)=>efficiency(s).toFixed(1)],[t.masterOpeners,()=> '60']].map(([name,fn])=><div className="compare-row" key={name as string}><span>{name as string}</span>{chosen.map(s=><b key={s.id}>{(fn as any)(s)}</b>)}</div>)}</div>:<div className="empty">{t.compareEmpty}</div>}</>}
