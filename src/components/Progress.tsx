import { calculateAttributeTotals } from '../utils/dashboard'
import { openersFor, formatValue } from '../utils/calculations'
import type { OwnedSeal, Attribute } from '../types'
import { seals } from '../data/seals'
import { PageHead } from './PageHead'
const attributes: Attribute[] = ['AT','HP','DS','DE','HT','CT','BL','EV']
export function Progress({t,owned}:{t:any,owned:OwnedSeal[]}){const totals=calculateAttributeTotals(owned,seals);return <><PageHead eyebrow={t.dashboardEyebrow} title={t.dashboard} text={t.dashboardText}/><div className="dashboard-top"><div><span>{t.total} {t.sealed}</span><b>{owned.length}</b></div><div><span>{t.openersForSeals}</span><b>{owned.reduce((n,o)=>n+openersFor(o.quantity),0)}</b></div><div><span>{t.records}</span><b>{seals.length}</b></div></div><div className="attribute-grid">{attributes.map(a=><div className="attribute-card" key={a}><span className={'attr '+a}>{a}</span><b>{formatValue(totals[a],a)}</b><i><em style={{width:`${Math.min(100,totals[a]/600*100)}%`}}/></i></div>)}</div></>}
